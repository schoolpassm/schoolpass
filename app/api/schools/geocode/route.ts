import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { geocodeAddress } from "@/lib/geocode";

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

/**
 * 위경도가 없는 학교를 최대 50건씩 찾아 Kakao Local API로 지오코딩한 뒤
 * schools_detail + schools_summary에 lat/lng를 채워넣는다.
 * 한 번 호출에 50건만 처리하도록 bounded — 버튼을 여러 번 누르면 점진적으로 전체가 채워진다.
 */
export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "인증 실패" }, { status: 500 });
  }

  const db = getAdminDb();
  const region: string | undefined = (await req.json().catch(() => ({})))?.region;

  let snapQuery = db.collection("schools_summary").limit(200) as FirebaseFirestore.Query;
  if (region) snapQuery = db.collection("schools_summary").where("region", "==", region).limit(200);

  const snap = await snapQuery.get();
  const targets = snap.docs.filter((d) => typeof d.data().lat !== "number" && d.data().address).slice(0, 50);

  let success = 0;
  let failed = 0;

  for (const docSnap of targets) {
    const data = docSnap.data();
    try {
      const coords = await geocodeAddress(data.address);
      if (!coords) {
        failed += 1;
        continue;
      }
      const batch = db.batch();
      batch.update(db.collection("schools_detail").doc(docSnap.id), coords);
      batch.update(db.collection("schools_summary").doc(docSnap.id), coords);
      await batch.commit();
      success += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, processed: targets.length, success, failed });
}
