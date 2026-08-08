import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * 관리자가 화면에서 새 팀원 계정을 생성한다.
 * - Firebase Auth 계정 생성 (이메일+임시비밀번호)
 * - users/{uid} Firestore 문서 생성
 * - 커스텀 클레임까지 바로 설정 (별도로 "권한 동기화" 안 눌러도 되게)
 * 셀프 회원가입이 아니라 admin/manager만 호출 가능 — 영업 데이터 보안을 위해 승인 절차 없이는 계정 생성 불가.
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

  const callerSnap = await db.collection("users").doc(decoded.uid).get();
  const callerRole = callerSnap.exists ? callerSnap.data()?.role : null;
  if (callerRole !== "admin" && callerRole !== "manager") {
    return NextResponse.json({ error: "admin/manager 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, email, password, role, region } = body as {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    region?: string;
  };

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "이름/이메일/비밀번호/권한을 모두 입력해주세요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 });
  }
  // manager는 admin 계정을 만들 수 없게 제한 (권한 상승 방지)
  if (callerRole === "manager" && role === "admin") {
    return NextResponse.json({ error: "매니저는 관리자 계정을 생성할 수 없습니다." }, { status: 403 });
  }

  try {
    const newUser = await auth.createUser({ email, password, displayName: name });

    await db.collection("users").doc(newUser.uid).set({
      name,
      email,
      role,
      region: region || null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await auth.setCustomUserClaims(newUser.uid, { role, active: true });

    return NextResponse.json({ ok: true, uid: newUser.uid });
  } catch (err: any) {
    const message =
      err?.code === "auth/email-already-exists" ? "이미 사용 중인 이메일입니다." : err?.message || "계정 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
