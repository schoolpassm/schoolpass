import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { callClaude } from "@/lib/ai";
import { buildInstitutionPrompt, modelForInstitutionAction, InstitutionAiAction, InstitutionContext } from "@/lib/institution-ai-prompts";

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

const VALID_ACTIONS: InstitutionAiAction[] = [
  "call_script",
  "email",
  "sms",
  "proposal",
  "objection_handling",
  "expected_questions",
  "next_action",
];

export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const institutionId: string | undefined = body?.institutionId;
  const action: InstitutionAiAction | undefined = body?.action;

  if (!institutionId || !action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "institutionId와 유효한 action이 필요합니다." }, { status: 400 });
  }

  const db = getAdminDb();

  try {
    const snap = await db.collection("institutions").doc(institutionId).get();
    if (!snap.exists) return NextResponse.json({ error: "관공서를 찾을 수 없습니다." }, { status: 404 });
    const inst: any = { id: institutionId, ...snap.data()! };

    const activitiesSnap = await db
      .collection("institutions")
      .doc(institutionId)
      .collection("activities")
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const recentActivitySummaries = activitiesSnap.docs.map((d) => `[${d.get("type")}] ${d.get("summary")}`);

    let daysSinceLastContact: number | null = null;
    if (inst.lastContactedAt) {
      const last = inst.lastContactedAt.toDate ? inst.lastContactedAt.toDate() : new Date(inst.lastContactedAt);
      daysSinceLastContact = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
    }

    let daysSinceStatusChange: number | null = null;
    if (inst.updatedAt) {
      const updated = inst.updatedAt.toDate ? inst.updatedAt.toDate() : new Date(inst.updatedAt);
      daysSinceStatusChange = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));
    }

    const nextContactDueAt = inst.nextContactDueAt
      ? (inst.nextContactDueAt.toDate ? inst.nextContactDueAt.toDate() : new Date(inst.nextContactDueAt)).toISOString().slice(0, 10)
      : null;

    const ctx: InstitutionContext = {
      name: inst.name,
      type: inst.type,
      region: inst.region,
      status: inst.status,
      grade: inst.grade,
      ownerName: inst.ownerName,
      contactName: inst.contactName,
      contactTitle: inst.contactTitle,
      daysSinceLastContact,
      daysSinceStatusChange,
      budgetStatus: inst.budgetStatus,
      nextContactDueAt,
      expectedAdoptionPeriod: inst.expectedAdoptionPeriod,
      recentActivitySummaries,
    };

    const { system, prompt, maxTokens } = buildInstitutionPrompt(action, ctx);
    const model = modelForInstitutionAction(action);
    const text = await callClaude(prompt, { system, maxTokens, model });

    return NextResponse.json({ ok: true, action, model, text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("institution AI generate error:", e);
    return NextResponse.json({ error: `AI 생성 중 오류: ${message}` }, { status: 500 });
  }
}
