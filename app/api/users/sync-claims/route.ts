import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * users/{uid}.role, active 값을 Firebase Auth 커스텀 클레임(request.auth.token.role 등)에 동기화한다.
 *
 * 왜 필요한가: Firestore의 count() 집계쿼리는 다른 문서를 get()으로 조회하는 보안규칙과 호환되지 않는다.
 * 기존 isManager()는 users/{uid} 문서를 get()으로 읽어 role을 확인하는 방식이라 대시보드 통계(count) 쿼리가
 * 항상 permission-denied로 막혔다. 커스텀 클레임은 로그인 토큰 자체에 role이 실려있어 get() 없이도
 * 규칙에서 request.auth.token.role로 바로 확인할 수 있어 집계쿼리와 호환된다.
 *
 * body가 비어있으면 "내 권한"을 동기화(로그인 사용자 누구나 최초 1회 실행 가능, 자기 자신 것만 건드림).
 * body.targetUid가 있으면 다른 사용자 권한 동기화 — 호출자가 admin/manager여야 함.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const authMod = await import("firebase-admin/auth");
  const { getApps } = await import("firebase-admin/app");
  const db = getAdminDb();
  const auth = authMod.getAuth(getApps()[0]);

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 로그인입니다." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUid: string = body?.targetUid || decoded.uid;

  if (targetUid !== decoded.uid) {
    // 남의 권한을 바꾸려면 호출자가 admin/manager여야 함
    const callerSnap = await db.collection("users").doc(decoded.uid).get();
    const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
    if (callerRole !== "admin" && callerRole !== "manager") {
      return NextResponse.json({ error: "admin/manager 권한이 필요합니다." }, { status: 403 });
    }
  }

  const targetSnap = await db.collection("users").doc(targetUid).get();
  if (!targetSnap.exists) {
    return NextResponse.json({ error: "사용자 문서를 찾을 수 없습니다." }, { status: 404 });
  }
  const data = targetSnap.data()!;

  await auth.setCustomUserClaims(targetUid, {
    role: data.role ?? "partner",
    active: data.active !== false,
  });

  return NextResponse.json({ ok: true, uid: targetUid, role: data.role, active: data.active !== false });
}
