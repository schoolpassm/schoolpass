import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { callClaude } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function assertAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 });

  const authMod = await import("firebase-admin/auth");
  const { getApps } = await import("firebase-admin/app");
  getAdminDb();
  const decoded = await authMod.getAuth(getApps()[0]).verifyIdToken(token);

  const db = getAdminDb();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin" && role !== "manager") {
    throw new Response(JSON.stringify({ error: "admin/manager 권한이 필요합니다." }), { status: 403 });
  }
}

const SYSTEM_PROMPT = `당신은 대한민국 학교 출입통제 시스템 "스쿨패스(SchoolPass)" 영업팀의 AI Copilot입니다.
정중한 존댓말을 쓰고, 아래 [실제 데이터]에 없는 사실이나 숫자를 절대로 지어내지 않습니다.
데이터에 없는 질문이면 "그 정보는 지금 데이터에 없습니다"라고 솔직히 답합니다.
답변은 3~6문장, 실행 가능한 조언 위주로.`;

export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const question: string | undefined = body?.question;
  const schoolId: string | undefined = body?.schoolId;
  if (!question || !question.trim()) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }

  const db = getAdminDb();

  try {
    let dataBlock: string;

    if (schoolId) {
      const snap = await db.collection("schools_detail").doc(schoolId).get();
      if (!snap.exists) return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
      const s = snap.data()!;
      const activitiesSnap = await db
        .collection("schools_detail")
        .doc(schoolId)
        .collection("activities")
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      const activities = activitiesSnap.docs.map((d) => `[${d.get("type")}] ${d.get("summary")}`);

      dataBlock = `[실제 데이터 - 학교: ${s.name}]
- 지역: ${s.region}, 학교급: ${s.level}, 학생수: ${s.studentCount ?? "정보없음"}명
- 영업 단계: ${s.status}, 등급: ${s.grade}
- AI 계약가능성 점수: ${s.aiScore ?? "아직 미측정"}
- 교육지원청: ${s.eduOfficeName ?? "정보없음"}
- 담당자: ${s.ownerName ?? "미지정"}
- 최근 활동: ${activities.join(" / ") || "없음"}`;
    } else {
      const [topScoredSnap, stageSnap] = await Promise.all([
        db.collection("schools_summary").orderBy("aiScore", "desc").limit(15).get(),
        db.collection("schools_summary").where("status", "==", "계약").count().get(),
      ]);
      const topSchools = topScoredSnap.docs.map((d) => `${d.get("name")}(${d.get("aiScore")}점, ${d.get("region")})`);
      dataBlock = `[실제 데이터 - 전체 포트폴리오]
- AI 점수 상위 15개 학교: ${topSchools.join(", ") || "없음"}
- 계약 단계 학교 수: ${stageSnap.data().count}`;
    }

    const prompt = `${dataBlock}\n\n[질문]\n${question.trim()}`;
    const text = await callClaude(prompt, { system: SYSTEM_PROMPT, maxTokens: 600, model: "claude-haiku-4-5-20251001" });

    return NextResponse.json({ ok: true, text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("copilot error:", e);
    return NextResponse.json({ error: `AI 응답 중 오류: ${message}` }, { status: 500 });
  }
}
