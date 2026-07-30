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

const SYSTEM_PROMPT = `당신은 대한민국 학교 출입통제 시스템 "스쿨패스(SchoolPass)" 영업팀을 지원하는 AI 분석가입니다.
정중한 존댓말을 쓰고, 제공된 [실제 데이터]에 없는 숫자나 사실을 절대로 지어내지 않습니다.
데이터가 부족하면 "데이터가 부족합니다"라고 솔직히 말합니다. 간결하고 실행 가능한 조언 위주로 답합니다.`;

export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const action: string = body?.action;
  const db = getAdminDb();

  try {
    if (action === "daily_briefing") {
      const [topScoredSnap, newSnap, contractSnap, installedCountSnap] = await Promise.all([
        db.collection("schools_summary").orderBy("aiScore", "desc").limit(10).get(),
        db.collection("schools_summary").where("status", "==", "신규").limit(50).get(),
        db.collection("schools_summary").where("status", "==", "계약").count().get(),
        db.collection("schools_summary").where("status", "==", "설치완료").count().get(),
      ]);
      const topSchools = topScoredSnap.docs.map((d) => `${d.get("name")}(${d.get("aiScore")}점, ${d.get("region")})`);
      const newCount = newSnap.size;

      const dataBlock = `[실제 데이터]
- AI 점수 상위 10개 학교: ${topSchools.join(", ") || "없음"}
- 신규(미접촉) 학교 수(최대 50건 샘플 기준): ${newCount}
- 계약 단계 학교 수: ${contractSnap.data().count}
- 설치완료(구축) 학교 수: ${installedCountSnap.data().count}`;

      const prompt = `${dataBlock}\n\n오늘 영업팀에게 전달할 아침 브리핑을 3~5문장으로 작성해줘. 오늘 우선적으로 할 일과, 위 데이터에서 눈에 띄는 포인트를 짚어줘.`;
      const text = await callClaude(prompt, { system: SYSTEM_PROMPT, maxTokens: 500, model: "claude-haiku-4-5-20251001" });
      return NextResponse.json({ ok: true, text });
    }

    if (action === "budget_recommendations") {
      const [byFinanceSnap, byFundSnap] = await Promise.all([
        db.collection("schools_summary").orderBy("financeRevenueTotal", "desc").limit(10).get(),
        db.collection("schools_summary").orderBy("developmentFundTotal", "desc").limit(10).get(),
      ]);
      const byFinance = byFinanceSnap.docs.map((d) => ({
        id: d.id,
        name: d.get("name"),
        region: d.get("region"),
        financeRevenueTotal: d.get("financeRevenueTotal"),
        status: d.get("status"),
      }));
      const byFund = byFundSnap.docs.map((d) => ({
        id: d.id,
        name: d.get("name"),
        region: d.get("region"),
        developmentFundTotal: d.get("developmentFundTotal"),
        status: d.get("status"),
      }));
      return NextResponse.json({ ok: true, byFinance, byFund });
    }

    if (action === "eduoffice_analysis") {
      const eduOfficeName: string | undefined = body?.eduOfficeName;
      if (!eduOfficeName) return NextResponse.json({ error: "eduOfficeName이 필요합니다." }, { status: 400 });

      const [totalSnap, installedSnap, contractSnap, topSchoolsSnap] = await Promise.all([
        db.collection("schools_summary").where("eduOfficeName", "==", eduOfficeName).count().get(),
        db
          .collection("schools_summary")
          .where("eduOfficeName", "==", eduOfficeName)
          .where("status", "==", "설치완료")
          .count()
          .get(),
        db.collection("schools_summary").where("eduOfficeName", "==", eduOfficeName).where("status", "==", "계약").count().get(),
        db
          .collection("schools_summary")
          .where("eduOfficeName", "==", eduOfficeName)
          .orderBy("aiScore", "desc")
          .limit(5)
          .get(),
      ]);

      const total = totalSnap.data().count;
      const installed = installedSnap.data().count;
      const contracted = contractSnap.data().count;
      const topSchools = topSchoolsSnap.docs.map((d) => `${d.get("name")}(${d.get("aiScore")}점)`);

      if (total === 0) {
        return NextResponse.json({
          ok: true,
          stats: { total: 0, installed: 0, contracted: 0, rate: 0 },
          text: "이 교육지원청 소속으로 확인된 학교 데이터가 아직 없습니다. 공공데이터 동기화를 먼저 실행해보세요.",
        });
      }

      const rate = Math.round(((installed + contracted) / total) * 1000) / 10;
      const dataBlock = `[실제 데이터]
- 교육지원청: ${eduOfficeName}
- 관할 학교 수: ${total}곳
- 구축완료: ${installed}곳, 계약중: ${contracted}곳 (계약률 ${rate}%)
- AI 점수 상위 학교: ${topSchools.join(", ") || "점수 매긴 학교 없음"}`;

      const prompt = `${dataBlock}\n\n이 교육지원청 관할 구역에 대한 영업 전략을 3~4문장으로 제안해줘. 계약률이 낮으면 그 이유를 추측하지 말고, 우선 접촉할 학교를 추천하는 데 집중해줘.`;
      const text = await callClaude(prompt, { system: SYSTEM_PROMPT, maxTokens: 500, model: "claude-haiku-4-5-20251001" });

      return NextResponse.json({ ok: true, stats: { total, installed, contracted, rate }, text });
    }

    return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("portfolio AI error:", e);
    return NextResponse.json({ error: `AI 분석 중 오류: ${message}` }, { status: 500 });
  }
}
