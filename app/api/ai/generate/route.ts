import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { callClaude } from "@/lib/ai";
import { buildPrompt, modelForAction, AiAction, SchoolContext, InstalledNeighbor } from "@/lib/ai-prompts";
import { haversineDistanceKm } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function assertAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 });

  const authMod = await import("firebase-admin/auth");
  const { getApps } = await import("firebase-admin/app");
  getAdminDb(); // admin app 초기화 보장
  const decoded = await authMod.getAuth(getApps()[0]).verifyIdToken(token);

  const db = getAdminDb();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin" && role !== "manager") {
    throw new Response(JSON.stringify({ error: "admin/manager 권한이 필요합니다." }), { status: 403 });
  }
  return decoded.uid;
}

const VALID_ACTIONS: AiAction[] = [
  "call_script",
  "email",
  "sms",
  "proposal",
  "visit_log",
  "score",
  "nearby_cases",
  "counseling_summary",
  "expected_questions",
  "objection_handling",
  "selling_points",
];

/**
 * 실제 데이터를 조회해 "실제 확인된 근거"와 "인근/유사 구축학교" 목록을 계산한다.
 * AI는 여기서 계산된 사실만 근거로 사용하도록 프롬프트에서 강제한다 (환각 방지).
 * 모든 쿼리는 schools_summary에 bounded(limit)로만 접근해 전체 스캔을 피한다.
 */
async function computeFactorsAndNeighbors(
  db: FirebaseFirestore.Firestore,
  school: FirebaseFirestore.DocumentData
) {
  const computedFactors: { label: string; positive: boolean }[] = [];
  const installedNeighbors: InstalledNeighbor[] = [];

  // 1) 같은 지역(교육청) 내 설치완료(구축) 학교 수 — count() 집계쿼리로 전체 문서를 읽지 않고 개수만 확인
  let installedInRegionCount = 0;
  try {
    const countSnap = await db
      .collection("schools_summary")
      .where("region", "==", school.region)
      .where("status", "==", "설치완료")
      .count()
      .get();
    installedInRegionCount = countSnap.data().count;
    if (installedInRegionCount > 0) {
      computedFactors.push({ label: `같은 지역(${school.region}) 구축학교 ${installedInRegionCount}곳`, positive: true });
    }
  } catch {
    // count() 미지원 환경 대비 — 실패해도 나머지 로직은 계속 진행
  }

  // 2) 학생수 규모 (전체 평균과 비교할 근거 데이터가 없으므로, 절대적 기준으로 판단)
  if (typeof school.studentCount === "number") {
    if (school.studentCount >= 800) {
      computedFactors.push({ label: `학생수 ${school.studentCount}명으로 규모가 큼`, positive: true });
    } else if (school.studentCount > 0 && school.studentCount < 200) {
      computedFactors.push({ label: `학생수 ${school.studentCount}명으로 소규모`, positive: false });
    }
  }

  if (typeof school.classCount === "number" && school.classCount >= 30) {
    computedFactors.push({ label: `학급수 ${school.classCount}개로 많음`, positive: true });
  }

  if (typeof school.teacherCount === "number" && school.teacherCount > 0) {
    computedFactors.push({ label: `교직원 ${school.teacherCount}명`, positive: school.teacherCount >= 50 });
  }

  if (typeof school.financeRevenueTotal === "number" && school.financeRevenueTotal > 0) {
    const eok = school.financeRevenueTotal / 100000000;
    if (eok >= 5) {
      computedFactors.push({ label: `학교회계 세입 규모 약 ${eok.toFixed(1)}억원으로 큼`, positive: true });
    }
  }

  if (typeof school.developmentFundTotal === "number" && school.developmentFundTotal > 0) {
    const man = Math.round(school.developmentFundTotal / 10000);
    computedFactors.push({ label: `학교발전기금 약 ${man.toLocaleString()}만원 보유`, positive: true });
  }

  if (school.supportFacilities) {
    const f = school.supportFacilities;
    const count = [f.gym, f.auditorium, f.pool, f.careerRoom].filter((v: number) => v > 0).length;
    if (count >= 2) {
      computedFactors.push({ label: `학생지원시설 우수 (체육관·강당·수영장·상담실 중 ${count}종 보유)`, positive: true });
    }
  }

  if (school.facilitySafetyOk === true) {
    computedFactors.push({ label: "시설안전 점검 완료 (이상없음)", positive: true });
  } else if (school.facilitySafetyOk === false) {
    computedFactors.push({ label: "시설안전 점검 결과 관리 필요", positive: false });
  }

  if (school.isNewlyOpened) {
    computedFactors.push({ label: "신설 학교 (예산 편성 초기 접근 유리)", positive: true });
  }
  if (school.hasKindergarten) {
    computedFactors.push({ label: "병설유치원 운영 중 (출입관리 필요성 높음)", positive: true });
  }

  // 3) 최근 접촉 경과일
  let daysSinceLastContact: number | null = null;
  if (school.lastContactedAt) {
    const last = school.lastContactedAt.toDate ? school.lastContactedAt.toDate() : new Date(school.lastContactedAt);
    daysSinceLastContact = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastContact >= 30) {
      computedFactors.push({ label: `최근 ${daysSinceLastContact}일간 미접촉`, positive: false });
    }
  } else {
    computedFactors.push({ label: "접촉 이력 없음 (첫 접근 필요)", positive: false });
  }

  // 4) 인근/유사 구축학교 후보 조회 (같은 지역, 설치완료 상태, 최대 20건 bounded)
  try {
    const neighborSnap = await db
      .collection("schools_summary")
      .where("region", "==", school.region)
      .where("status", "==", "설치완료")
      .limit(20)
      .get();

    const candidates = neighborSnap.docs
      .filter((d) => d.id !== school.id)
      .map((d) => {
        const data = d.data();
        let distanceKm: number | undefined;
        if (typeof school.lat === "number" && typeof school.lng === "number" && typeof data.lat === "number" && typeof data.lng === "number") {
          distanceKm = haversineDistanceKm(school.lat, school.lng, data.lat, data.lng);
        }
        return {
          name: data.name as string,
          distanceKm,
          studentCount: data.studentCount as number | undefined,
          sameEduOffice: data.eduOfficeId && data.eduOfficeId === school.eduOfficeId,
          sameLevel: data.level === school.level,
        } as InstalledNeighbor;
      });

    // 우선순위: 거리(가까운순) > 같은 교육지원청 > 학생수 유사 > 같은 학교급
    candidates.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      if (a.sameEduOffice !== b.sameEduOffice) return a.sameEduOffice ? -1 : 1;
      const aDiff = a.studentCount != null && school.studentCount ? Math.abs(a.studentCount - school.studentCount) : Infinity;
      const bDiff = b.studentCount != null && school.studentCount ? Math.abs(b.studentCount - school.studentCount) : Infinity;
      return aDiff - bDiff;
    });

    installedNeighbors.push(...candidates.slice(0, 5));
    if (candidates.some((c) => c.distanceKm != null)) {
      const nearest = candidates.find((c) => c.distanceKm != null);
      if (nearest?.distanceKm != null) {
        computedFactors.push({ label: `가장 가까운 구축학교 ${nearest.name} (${nearest.distanceKm.toFixed(1)}km)`, positive: true });
      }
    }
  } catch (err) {
    console.error("nearby neighbor query failed", err);
  }

  return { computedFactors, installedNeighbors, daysSinceLastContact };
}

export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("AI generate auth error:", e);
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { schoolId, action } = body as { schoolId?: string; action?: AiAction };

  if (!schoolId || !action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "schoolId와 유효한 action이 필요합니다." }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const schoolSnap = await db.collection("schools_detail").doc(schoolId).get();
    if (!schoolSnap.exists) {
      return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
    }
    const school: any = { id: schoolId, ...schoolSnap.data()! };

    // 최근 활동기록 5건
    const activitiesSnap = await db
      .collection("schools_detail")
      .doc(schoolId)
      .collection("activities")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const recentActivitySummaries = activitiesSnap.docs.map((d) => `[${d.get("type")}] ${d.get("summary")}`);

    // 같은 지역 구축사례(후기) 3건
    const casesSnap = await db.collection("cases").where("region", "==", school.region).limit(3).get();
    const nearbyCaseSummaries = casesSnap.docs.map(
      (d) => `${d.get("schoolName")} (${d.get("installYear")}년 설치) - ${d.get("review") || "후기 없음"}`
    );

    const { computedFactors, installedNeighbors, daysSinceLastContact } = await computeFactorsAndNeighbors(db, school);

    const ctx: SchoolContext = {
      name: school.name,
      region: school.region,
      level: school.level,
      studentCount: school.studentCount,
      classCount: school.classCount,
      status: school.status,
      grade: school.grade,
      ownerName: school.ownerName,
      isNewlyOpened: school.isNewlyOpened,
      hasKindergarten: school.hasKindergarten,
      daysSinceLastContact,
      recentActivitySummaries,
      nearbyCaseSummaries,
      installedNeighbors,
      computedFactors,
    };

    const { system, prompt, maxTokens } = buildPrompt(action, ctx);
    const model = modelForAction(action);
    const text = await callClaude(prompt, { system, maxTokens, model });

    let scoreValue: number | null = null;
    if (action === "score") {
      const match = text.match(/점수[:\s]*([0-9]{1,3})/);
      if (match) scoreValue = Math.min(100, parseInt(match[1], 10));
    }

    // AI 생성 이력 로그 (schools_detail/{id}/ai_logs) — 재생성 추적용
    await db
      .collection("schools_detail")
      .doc(schoolId)
      .collection("ai_logs")
      .add({
        action,
        model,
        resultText: text,
        score: scoreValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return NextResponse.json({
      ok: true,
      action,
      model,
      text,
      score: scoreValue,
      factors: computedFactors,
      installedNeighbors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("AI generate error:", e);
    return NextResponse.json({ error: `AI 생성 중 오류: ${message}` }, { status: 500 });
  }
}
