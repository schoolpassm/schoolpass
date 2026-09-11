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

const WINDOW_SIZE = 200; // 한 번에 훑어볼 문서 범위 (이 중 위경도 없는 것만 최대 MAX_PER_CALL건 처리)
const MAX_PER_CALL = 30; // Vercel Hobby 실행시간(~10초) 안에 여유있게 끝나도록 제한
const CONCURRENCY = 5; // Kakao API를 5개씩 동시 호출해 처리 시간을 단축

/**
 * 위경도가 없는 학교를 문서ID 커서 기반으로 순회하며 찾아 Kakao Local API로 지오코딩한다.
 * (예전 버전은 커서 없이 매번 똑같은 첫 200건만 봐서, 전체 학교 수가 200건을 넘으면
 *  그 뒤에 있는 학교들에는 영원히 도달하지 못하는 버그가 있었다 — 이번에 커서 방식으로 고쳤다)
 * 클라이언트는 응답의 lastId를 다음 호출의 afterId로 넘겨서 계속 이어서 훑으면 된다.
 * done=true가 오면 컬렉션 끝까지 다 훑은 것이다.
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
  const region: string | undefined = body?.region;
  const afterId: string | undefined = body?.afterId;

  try {
    const work = (async () => {
      const { FieldPath } = await import("firebase-admin/firestore");

      let snapQuery = db.collection("schools_summary").orderBy(FieldPath.documentId()).limit(WINDOW_SIZE) as FirebaseFirestore.Query;
      if (region)
        snapQuery = db.collection("schools_summary").where("region", "==", region).orderBy(FieldPath.documentId()).limit(WINDOW_SIZE);
      if (afterId) {
        const cursorDoc = await db.collection("schools_summary").doc(afterId).get();
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
              const batch = db.batch();
              batch.update(db.collection("schools_detail").doc(docSnap.id), coords);
              batch.update(db.collection("schools_summary").doc(docSnap.id), coords);
              await batch.commit();
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
      const done = windowDocs.length < WINDOW_SIZE; // 이번 창이 WINDOW_SIZE보다 작게 찼다는 건 컬렉션 끝에 도달했다는 뜻

      return { ok: true, processed: targets.length, success, failed, lastId, done, windowScanned: windowDocs.length };
    })();

    // Vercel Hobby 플랜이 함수를 강제 종료시키면 JSON이 아닌 에러 페이지가 그대로 반환되어
    // 클라이언트에서 파싱 에러로 이어진다. 그 전에 9초 안전장치를 걸어 항상 깔끔한 JSON으로 답한다.
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
