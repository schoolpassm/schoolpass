import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchNeisSchools, mapNeisSchoolLevel, NEIS_REGION_CODES } from "@/lib/neis";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 대량 학교 동기화 대비 (Vercel Pro 기준, Hobby는 60초 제한에 유의)

/**
 * 확장성 설계
 * ---------------------------------------------------------------------------
 * NEIS의 SD_SCHUL_CODE(학교 고유코드)를 Firestore 문서ID로 그대로 사용한다.
 * 그 덕분에 "기존 학교 전체를 미리 읽어서 매칭 맵을 만드는" 방식이 필요 없다 —
 * 문서ID로 바로 upsert하면 되므로, 전국 10만 건이 있어도 이번에 동기화하는
 * 지역(region)의 학교 수에 비례하는 읽기/쓰기만 발생한다 (전체 스캔 없음).
 * ---------------------------------------------------------------------------
 */

async function assertAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
    return { via: "cron" as const };
  }

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
  return { via: "user" as const, uid: decoded.uid };
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    await assertAuthorized(req);
  } catch (e) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("NEIS sync auth error:", e);
    return NextResponse.json({ error: `인증 처리 중 오류: ${message}` }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const regionCodes: string[] =
    Array.isArray(body?.regionCodes) && body.regionCodes.length > 0
      ? body.regionCodes
      : NEIS_REGION_CODES.map((r) => r.code);
  const schoolName: string | undefined = body?.schoolName;

  const db = getAdminDb();

  let created = 0;
  let updated = 0;
  let closedDetected = 0;
  const failedRegions: string[] = [];

  for (const regionCode of regionCodes) {
    try {
      const rows = await fetchNeisSchools(regionCode, schoolName);
      const seenCodes = new Set<string>();
      let regionName: string | undefined;
      const chunks: (typeof rows)[] = [];
      for (let i = 0; i < rows.length; i += 300) chunks.push(rows.slice(i, i + 300));

      for (const chunk of chunks) {
        // 이번 청크(최대 300건)에 한해서만 존재 여부를 확인 — 전체 컬렉션 스캔이 아니라
        // "이번에 동기화하는 학교들"에 비례하는 읽기만 발생한다.
        const existSnaps = await Promise.all(
          chunk.map((row) => db.collection("schools_detail").doc(row.SD_SCHUL_CODE).get())
        );

        const batch = db.batch();
        chunk.forEach((row, idx) => {
          seenCodes.add(row.SD_SCHUL_CODE);
          regionName = row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM;
          const exists = existSnaps[idx].exists;
          const detailRef = db.collection("schools_detail").doc(row.SD_SCHUL_CODE);
          const summaryRef = db.collection("schools_summary").doc(row.SD_SCHUL_CODE);

          const masterFields = {
            name: row.SCHUL_NM,
            region: row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM,
            level: mapNeisSchoolLevel(row.SCHUL_KND_SC_NM),
            address: row.ORG_RDNMA ?? "",
            phone: row.ORG_TELNO ?? "",
            neisSchoolCode: row.SD_SCHUL_CODE,
            isClosed: false,
            lastSyncedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };
          const summaryFields = {
            name: masterFields.name,
            region: masterFields.region,
            level: masterFields.level,
            address: masterFields.address,
            phone: masterFields.phone,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (exists) {
            // 이미 등록된 학교: 영업 관련 필드(status/grade/ownerName/tags/note/partnerId)는 건드리지 않고
            // NEIS 원본 마스터 정보만 갱신한다. (재등장했으므로 폐교 플래그도 다시 해제)
            batch.set(detailRef, masterFields, { merge: true });
            batch.set(summaryRef, summaryFields, { merge: true });
            updated += 1;
          } else {
            batch.set(detailRef, {
              ...masterFields,
              status: "신규",
              grade: "C",
              tags: ["학교알리미동기화"],
              archived: false,
              syncedFromNeis: true,
              createdAt: FieldValue.serverTimestamp(),
            });
            batch.set(summaryRef, {
              ...summaryFields,
              status: "신규",
              grade: "C",
              tags: ["학교알리미동기화"],
            });
            created += 1;
          }
        });
        await batch.commit();
      }

      // 폐교 감지: 이 지역에서 NEIS 동기화로 등록됐던 기존 학교 중, 이번 응답에 없는 학교는 폐교로 간주한다.
      // region 필드로 bounded 쿼리(전체 스캔 아님), 500건씩 페이지네이션.
      if (regionName) {
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        while (true) {
          let q = db
            .collection("schools_detail")
            .where("region", "==", regionName)
            .where("syncedFromNeis", "==", true)
            .where("isClosed", "==", false)
            .limit(500) as FirebaseFirestore.Query;
          if (cursor) q = q.startAfter(cursor);
          const snap = await q.get();
          if (snap.empty) break;

          const closeBatch = db.batch();
          let anyClosed = false;
          snap.docs.forEach((doc) => {
            const code = doc.get("neisSchoolCode");
            if (code && !seenCodes.has(code)) {
              closeBatch.set(
                db.collection("schools_detail").doc(doc.id),
                { isClosed: true, updatedAt: FieldValue.serverTimestamp() },
                { merge: true }
              );
              closeBatch.set(
                db.collection("schools_summary").doc(doc.id),
                { updatedAt: FieldValue.serverTimestamp() },
                { merge: true }
              );
              anyClosed = true;
              closedDetected += 1;
            }
          });
          if (anyClosed) await closeBatch.commit();

          if (snap.docs.length < 500) break;
          cursor = snap.docs[snap.docs.length - 1];
        }
      }
    } catch (err) {
      console.error(`NEIS sync failed for region ${regionCode}`, err);
      failedRegions.push(regionCode);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    closedDetected,
    regionsSynced: regionCodes.length - failedRegions.length,
    failedRegions,
  });
}
