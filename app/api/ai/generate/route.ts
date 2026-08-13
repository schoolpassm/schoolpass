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
 * 실제 데이터를 조회해 "실제 확인된 근거"와 "인근/유사 구축학교" 목록, 그리고
 * 가중치 기반 계약가능성 점수를 계산한다.
 *
 * 이전 방식: AI에게 근거 목록을 주고 "몇 점일지 알아서 판단해줘"라고 시켰음 → 매번 조금씩
 * 다르게 나오고, 근거와 점수 사이 정합성을 보장할 수 없었음.
 * 이번 방식: 점수는 아래 고정된 가중치 표로 코드가 직접 계산하고(항상 같은 입력 → 항상 같은 점수),
 * AI는 "왜 이 점수인지" 설명만 담당한다. 정확도와 일관성이 훨씬 높아진다.
 *
 * 모든 쿼리는 schools_summary에 bounded(limit)로만 접근해 전체 스캔을 피한다.
 * (2개의 독립 쿼리를 Promise.all로 병렬 실행해 응답시간을 단축한다 — Vercel Hobby 플랜의
 *  짧은 함수 실행시간 제한 안에 들어오도록 하기 위한 최적화)
 */
async function computeFactorsAndNeighbors(
  db: FirebaseFirestore.Firestore,
  school: FirebaseFirestore.DocumentData
) {
  const computedFactors: { label: string; positive: boolean }[] = [];
  const installedNeighbors: InstalledNeighbor[] = [];
  let points = 50; // 기준점 (중립) — 아래 항목마다 가중치를 더하거나 뺀다

  const [countResult, neighborResult] = await Promise.allSettled([
    db.collection("schools_summary").where("region", "==", school.region).where("status", "==", "설치완료").count().get(),
    db.collection("schools_summary").where("region", "==", school.region).where("status", "==", "설치완료").limit(20).get(),
  ]);

  if (countResult.status === "fulfilled") {
    const installedInRegionCount = countResult.value.data().count;
    if (installedInRegionCount > 0) {
      computedFactors.push({ label: `같은 지역(${school.region}) 구축학교 ${installedInRegionCount}곳`, positive: true });
      points += Math.min(10, installedInRegionCount); // 최대 +10 (레퍼런스 효과)
    }
  }

  // 학생수 규모 (절대적 기준 — 전체 평균 데이터가 없어 상대비교는 하지 않음)
  if (typeof school.studentCount === "number" && school.studentCount > 0) {
    if (school.studentCount >= 1000) {
      computedFactors.push({ label: `학생수 ${school.studentCount}명으로 규모가 매우 큼`, positive: true });
      points += 15;
    } else if (school.studentCount >= 800) {
      computedFactors.push({ label: `학생수 ${school.studentCount}명으로 규모가 큼`, positive: true });
      points += 10;
    } else if (school.studentCount < 200) {
      computedFactors.push({ label: `학생수 ${school.studentCount}명으로 소규모`, positive: false });
      points -= 10;
    }
  }

  if (typeof school.classCount === "number") {
    if (school.classCount >= 30) {
      computedFactors.push({ label: `학급수 ${school.classCount}개로 많음`, positive: true });
      points += 8;
    } else if (school.classCount >= 20) {
      points += 4;
    }
  }

  if (typeof school.teacherCount === "number" && school.teacherCount > 0) {
    const big = school.teacherCount >= 50;
    computedFactors.push({ label: `교직원 ${school.teacherCount}명`, positive: big });
    points += big ? 5 : school.teacherCount >= 30 ? 3 : 0;
  }

  if (typeof school.financeRevenueTotal === "number" && school.financeRevenueTotal > 0) {
    const eok = school.financeRevenueTotal / 100000000;
    const add = Math.min(15, Math.round(eok * 1.5)); // 세입 규모에 비례, 최대 +15
    if (eok >= 5) {
      computedFactors.push({ label: `학교회계 세입 규모 약 ${eok.toFixed(1)}억원으로 큼`, positive: true });
    }
    points += add;
  }

  if (typeof school.developmentFundTotal === "number" && school.developmentFundTotal > 0) {
    const man = Math.round(school.developmentFundTotal / 10000);
    computedFactors.push({ label: `학교발전기금 약 ${man.toLocaleString()}만원 보유`, positive: true });
    points += 5;
  }

  if (school.supportFacilities) {
    const f = school.supportFacilities;
    const count = [f.gym, f.auditorium, f.pool, f.careerRoom].filter((v: number) => v > 0).length;
    if (count >= 2) {
      computedFactors.push({ label: `학생지원시설 우수 (체육관·강당·수영장·상담실 중 ${count}종 보유)`, positive: true });
      points += 8;
    } else if (count === 1) {
      points += 4;
    }
  }

  if (school.facilitySafetyOk === true) {
    computedFactors.push({ label: "시설안전 점검 완료 (이상없음)", positive: true });
    points += 6;
  } else if (school.facilitySafetyOk === false) {
    computedFactors.push({ label: "시설안전 점검 결과 관리 필요", positive: false });
    points -= 8;
  }

  if (school.isNewlyOpened) {
    computedFactors.push({ label: "신설 학교 (예산 편성 초기 접근 유리)", positive: true });
    points += 10;
  }
  if (school.hasKindergarten) {
    computedFactors.push({ label: "병설유치원 운영 중 (출입관리 필요성 높음)", positive: true });
    points += 6;
  }

  // 최근 접촉 경과일
  let daysSinceLastContact: number | null = null;
  if (school.lastContactedAt) {
    const last = school.lastContactedAt.toDate ? school.lastContactedAt.toDate() : new Date(school.lastContactedAt);
    daysSinceLastContact = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLastContact >= 60) {
      computedFactors.push({ label: `최근 ${daysSinceLastContact}일간 미접촉 (장기 방치)`, positive: false });
      points -= 15;
    } else if (daysSinceLastContact >= 30) {
      computedFactors.push({ label: `최근 ${daysSinceLastContact}일간 미접촉`, positive: false });
      points -= 10;
    } else if (daysSinceLastContact >= 14) {
      points -= 3;
    }
  } else {
    computedFactors.push({ label: "접촉 이력 없음 (첫 접근 필요)", positive: false });
    points -= 12;
  }

  // 인근/유사 구축학교 후보 (위에서 병렬로 이미 받아온 결과 사용)
  if (neighborResult.status === "fulfilled") {
    const candidates = neighborResult.value.docs
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
    const nearest = candidates.find((c) => c.distanceKm != null);
    if (nearest?.distanceKm != null) {
      computedFactors.push({ label: `가장 가까운 구축학교 ${nearest.name} (${nearest.distanceKm.toFixed(1)}km)`, positive: true });
      if (nearest.distanceKm <= 3) points += 8;
      else if (nearest.distanceKm <= 10) points += 4;
    }
    if (nearest?.sameEduOffice) points += 5;
  }

  const weightedScore = Math.max(5, Math.min(98, Math.round(points)));
  return { computedFactors, installedNeighbors, daysSinceLastContact, weightedScore };
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

    // 서로 의존관계 없는 조회들을 한 번에 병렬 실행해 응답시간을 단축한다
    // (Vercel Hobby 플랜의 짧은 함수 실행시간 제한 안에 들어오도록 하기 위한 핵심 최적화)
    const [activitiesSnap, casesSnap, factorsResult, recentContractsSnap] = await Promise.all([
      db.collection("schools_detail").doc(schoolId).collection("activities").orderBy("createdAt", "desc").limit(5).get(),
      db.collection("cases").where("region", "==", school.region).limit(3).get(),
      computeFactorsAndNeighbors(db, school),
      action === "score" ? db.collection("contracts").orderBy("contractDate", "desc").limit(200).get() : Promise.resolve(null),
    ]);

    const recentActivitySummaries = activitiesSnap.docs.map((d) => `[${d.get("type")}] ${d.get("summary")}`);
    const nearbyCaseSummaries = casesSnap.docs.map(
      (d) => `${d.get("schoolName")} (${d.get("installYear")}년 설치) - ${d.get("review") || "후기 없음"}`
    );
    const { computedFactors, installedNeighbors, daysSinceLastContact, weightedScore } = factorsResult;

    const ctx: SchoolContext = {
      name: school.name,
      region: school.region,
      level: school.level,
      studentCount: school.studentCount,
      classCount: school.classCount,
      status: school.status,
      grade: school.grade,
      ownerName: school.ownerName,
      contactName: school.contactName,
      contactTitle: school.contactTitle,
      isNewlyOpened: school.isNewlyOpened,
      hasKindergarten: school.hasKindergarten,
      daysSinceLastContact,
      recentActivitySummaries,
      nearbyCaseSummaries,
      installedNeighbors,
      computedFactors,
      weightedScore: action === "score" ? weightedScore : undefined,
    };

    const { system, prompt, maxTokens } = buildPrompt(action, ctx);
    const model = modelForAction(action);
    const text = await callClaude(prompt, { system, maxTokens, model });

    let scoreValue: number | null = null;
    let expectedContractAmount: number | null = null;
    let recommendedVisitWindow: string | null = null;
    if (action === "score") {
      // 점수는 더 이상 AI 텍스트에서 정규식으로 추출하지 않는다 — 위에서 계산한 가중치 점수를
      // 그대로 신뢰값으로 사용해 일관성을 보장하고, AI 텍스트는 "왜 이 점수인지" 설명 역할만 한다.
      scoreValue = weightedScore;

      if (recentContractsSnap) {
        // 예상 계약금액: 최근 계약 200건의 평균 금액 × 점수 비율 (위에서 이미 병렬로 조회해둔 결과 사용)
        const amounts = recentContractsSnap.docs.map((d) => d.get("contractAmount")).filter((a) => typeof a === "number");
        if (amounts.length > 0) {
          const avg = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
          expectedContractAmount = Math.round((avg * scoreValue) / 100);
        }

        // 추천 방문시기: 점수 + 최근 접촉 경과일 기준 간단한 규칙
        if (scoreValue >= 80 && (daysSinceLastContact == null || daysSinceLastContact >= 14)) {
          recommendedVisitWindow = "이번 주 최우선 방문 대상";
        } else if (scoreValue >= 60) {
          recommendedVisitWindow = "이번 달 안에 방문 추천";
        } else if (daysSinceLastContact != null && daysSinceLastContact >= 30) {
          recommendedVisitWindow = "장기 미접촉 — 전화로 먼저 재접촉 추천";
        } else {
          recommendedVisitWindow = "우선순위 낮음 — 다른 학교 진행 후 검토";
        }
      }
    }

    // AI 생성 이력 로그 — 응답을 늦추지 않도록 await 하지 않고 백그라운드로 기록만 시도한다
    // (실패해도 사용자 응답에는 영향 없음, 감사용 로그일 뿐 핵심 기능 아님)
    db.collection("schools_detail")
      .doc(schoolId)
      .collection("ai_logs")
      .add({ action, model, resultText: text, score: scoreValue, createdAt: new Date(), updatedAt: new Date() })
      .catch((err) => console.error("ai_logs write failed", err));

    return NextResponse.json({
      ok: true,
      action,
      model,
      text,
      score: scoreValue,
      factors: computedFactors,
      installedNeighbors,
      expectedContractAmount,
      recommendedVisitWindow,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("AI generate error:", e);
    return NextResponse.json({ error: `AI 생성 중 오류: ${message}` }, { status: 500 });
  }
}
