import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchSchoolinfoRows, SCHOOLINFO_CATEGORIES, SchoolinfoCategory } from "@/lib/schoolinfo";
import { applySchoolinfoRows } from "@/lib/schoolinfo-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

/**
 * 시군구 1곳 + 학교급 1개만 처리하는 소단위 동기화.
 * Vercel Hobby 플랜의 짧은 함수 실행시간 제한 안에서 항상 끝나도록,
 * 큰 범위를 한 번에 순회하는 대신 화면(모달)에서 이 라우트를 여러 번 나눠 호출한다.
 */
export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const category: SchoolinfoCategory = body?.category ?? "student_count";
  if (!SCHOOLINFO_CATEGORIES[category]) {
    return NextResponse.json({ error: "알 수 없는 카테고리입니다." }, { status: 400 });
  }
  const year: number = body?.year ?? new Date().getFullYear();
  const levelCode: string | undefined = body?.levelCode;
  const sggCode: string | undefined = body?.sggCode;
  const sidoCode: string | undefined = body?.sidoCode;
  const regionHint: string | undefined = body?.regionHint;

  if (!levelCode || !sggCode || !sidoCode) {
    return NextResponse.json({ error: "levelCode/sggCode/sidoCode가 모두 필요합니다." }, { status: 400 });
  }

  const db = getAdminDb();
  try {
    const rows = await fetchSchoolinfoRows(category, year, levelCode, sggCode, sidoCode);
    const r = await applySchoolinfoRows(db, category, rows, regionHint);
    return NextResponse.json({ ok: true, ...r, rowCount: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
