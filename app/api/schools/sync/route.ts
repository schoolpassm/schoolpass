import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchNeisSchools, mapNeisSchoolLevel, NEIS_REGION_CODES } from "@/lib/neis";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 대량 학교 동기화 대비 (Vercel Pro 기준, Hobby는 60초 제한에 유의)

/**
 * 인증 체크
 * 1) Vercel Cron이 자동 호출하는 경우: Authorization: Bearer <CRON_SECRET>
 * 2) 관리자가 화면에서 수동 호출하는 경우: Authorization: Bearer <Firebase ID Token> + users/{uid}.role in [admin, manager]
 */
async function assertAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
    return { via: "cron" as const };
  }

  if (!token) throw new Response("Unauthorized", { status: 401 });

  const admin = await import("firebase-admin/auth");
  const { getApps } = await import("firebase-admin/app");
  // getAdminDb() 호출 시 admin app이 초기화되므로 먼저 db를 얻어둔다.
  getAdminDb();
  const decoded = await admin.getAuth(getApps()[0]).verifyIdToken(token);

  const db = getAdminDb();
  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin" && role !== "manager") {
    throw new Response("Forbidden: admin/manager 권한이 필요합니다.", { status: 403 });
  }
  return { via: "user" as const, uid: decoded.uid };
}

export async function GET(req: NextRequest) {
  // Vercel Cron은 GET으로 호출하며, CRON_SECRET 환경변수를 설정해두면
  // Vercel이 자동으로 Authorization: Bearer <CRON_SECRET> 헤더를 붙여 보낸다.
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

  // 기존 학교의 neisSchoolCode -> 문서ID 매핑을 미리 만들어 중복 생성을 방지한다.
  const existingSnap = await db.collection("schools").select("neisSchoolCode").get();
  const existingMap = new Map<string, string>();
  existingSnap.forEach((doc) => {
    const code = doc.get("neisSchoolCode");
    if (code) existingMap.set(code, doc.id);
  });

  let created = 0;
  let updated = 0;
  let failedRegions: string[] = [];

  for (const regionCode of regionCodes) {
    try {
      const rows = await fetchNeisSchools(regionCode, schoolName);
      const chunks = [];
      for (let i = 0; i < rows.length; i += 400) chunks.push(rows.slice(i, i + 400));

      for (const chunk of chunks) {
        const batch = db.batch();
        for (const row of chunk) {
          const existingId = existingMap.get(row.SD_SCHUL_CODE);
          const masterFields = {
            name: row.SCHUL_NM,
            region: row.LCTN_SC_NM || row.ATPT_OFCDC_SC_NM,
            level: mapNeisSchoolLevel(row.SCHUL_KND_SC_NM),
            address: row.ORG_RDNMA ?? "",
            phone: row.ORG_TELNO ?? "",
            neisSchoolCode: row.SD_SCHUL_CODE,
            lastSyncedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (existingId) {
            // 이미 등록된 학교: 영업 관련 필드(status/grade/ownerName/tags/note/partnerId)는 건드리지 않고
            // NEIS 원본 마스터 정보만 갱신한다.
            batch.update(db.collection("schools").doc(existingId), masterFields);
            updated += 1;
          } else {
            const ref = db.collection("schools").doc();
            batch.set(ref, {
              ...masterFields,
              status: "신규",
              grade: "C",
              tags: ["학교알리미동기화"],
              archived: false,
              syncedFromNeis: true,
              createdAt: FieldValue.serverTimestamp(),
            });
            existingMap.set(row.SD_SCHUL_CODE, ref.id);
            created += 1;
          }
        }
        await batch.commit();
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
    regionsSynced: regionCodes.length - failedRegions.length,
    failedRegions,
  });
}
