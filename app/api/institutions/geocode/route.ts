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

const WINDOW_SIZE = 200;
const MAX_PER_CALL = 30;
const CONCURRENCY = 5;

/**
 * institutions 컬렉션(관공서·교육행정기관, 단일 컬렉션이라 schools의 summary/detail 분리 없음)의
 * 위경도가 없는 문서를 커서 기반으로 순회하며 Kakao Local API로 지오코딩한다.
 * app/api/schools/geocode/route.ts와 같은 패턴 — 지도(스펙 14번)에 관공서 마커를 표시하려면
 * 좌표가 필요한데, 지금까지는 institutions에 좌표를 채우는 경로가 아예 없었다.
 */
export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "인증 실패" }, { status: 500 });
  }

  const db = getAdminDb();
  const body = await req.json().catch(() => ({}));
  const afterId: string | undefined = body?.afterId;

  try {
    const work = (async () => {
      const { FieldPath } = await import("firebase-admin/firestore");

      let snapQuery = db.collection("institutions").orderBy(FieldPath.documentId()).limit(WINDOW_SIZE) as FirebaseFirestore.Query;
      if (afterId) {
        const cursorDoc = await db.collection("institutions").doc(afterId).get();
        if (cursorDoc.exists) snapQuery = snapQuery.startAfter(cursorDoc);
      }

      const snap = await snapQuery.get();
      const windowDocs = snap.docs;
      const targets = windowDocs.filter((d) => typeof d.data().lat !== "number" && d.data().address).slice(0, MAX_PER_CALL);

      let success = 0;
      let failed = 0;

      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          chunk.map(async (docSnap) => {
            const data = docSnap.data();
            try {
              const coords = await geocodeAddress(data.address);
              if (!coords) return false;
              await db.collection("institutions").doc(docSnap.id).update(coords);
              return true;
            } catch {
              return false;
            }
          })
        );
        for (const ok of results) {
          if (ok) success += 1;
          else failed += 1;
        }
      }

      const lastId = windowDocs.length > 0 ? windowDocs[windowDocs.length - 1].id : afterId ?? null;
      const done = windowDocs.length < WINDOW_SIZE;

      return { ok: true, processed: targets.length, success, failed, lastId, done, windowScanned: windowDocs.length };
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("이번 구간 처리가 9초를 넘겨 건너뜁니다. 자동 순회라면 이어서 재시도됩니다.")), 9000)
    );

    const result = await Promise.race([work, timeoutPromise]);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
