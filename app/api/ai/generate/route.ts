import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { callClaude } from "@/lib/ai";
import { buildPrompt, modelForAction, AiAction, SchoolContext } from "@/lib/ai-prompts";

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

const VALID_ACTIONS: AiAction[] = ["call_script", "email", "sms", "proposal", "visit_log", "score", "nearby_cases"];

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
    const schoolSnap = await db.collection("schools").doc(schoolId).get();
    if (!schoolSnap.exists) {
      return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
    }
    const school = schoolSnap.data()!;

    // 최근 활동기록 5건
    const activitiesSnap = await db
      .collection("schools")
      .doc(schoolId)
      .collection("activities")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const recentActivitySummaries = activitiesSnap.docs.map((d) => `[${d.get("type")}] ${d.get("summary")}`);

    // 같은 지역 구축사례 3건 (인근 학교 추천용 근사치 — region 문자열 일치 기준)
    const casesSnap = await db
      .collection("cases")
      .where("region", "==", school.region)
      .limit(3)
      .get();
    const nearbyCaseSummaries = casesSnap.docs.map(
      (d) => `${d.get("schoolName")} (${d.get("installYear")}년 설치) - ${d.get("review") || "후기 없음"}`
    );

    const ctx: SchoolContext = {
      name: school.name,
      region: school.region,
      level: school.level,
      studentCount: school.studentCount,
      status: school.status,
      grade: school.grade,
      ownerName: school.ownerName,
      isNewlyOpened: school.isNewlyOpened,
      recentActivitySummaries,
      nearbyCaseSummaries,
    };

    const { system, prompt, maxTokens } = buildPrompt(action, ctx);
    const model = modelForAction(action);
    const text = await callClaude(prompt, { system, maxTokens, model });

    let scoreValue: number | null = null;
    if (action === "score") {
      const match = text.match(/점수[:\s]*([0-9]{1,3})/);
      if (match) scoreValue = Math.min(100, parseInt(match[1], 10));
    }

    return NextResponse.json({ ok: true, action, model, text, score: scoreValue });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("AI generate error:", e);
    return NextResponse.json({ error: `AI 생성 중 오류: ${message}` }, { status: 500 });
  }
}
