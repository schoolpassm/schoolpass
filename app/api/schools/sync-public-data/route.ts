import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  fetchSchoolinfoRows,
  SCHOOLINFO_LEVEL_CODES,
  SCHOOLINFO_CATEGORIES,
  SchoolinfoCategory,
  SchoolinfoRow,
} from "@/lib/schoolinfo";
import { applySchoolinfoRows } from "@/lib/schoolinfo-apply";
import { SIGUNGU_CODES } from "@/lib/schoolinfo-regions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * ⚠️ Vercel Hobby 플랜은 서버리스 함수 실행시간이 짧게 제한되어(보통 10초),
 * 여러 시군구×학교급을 한 번에 순회하는 이 라우트는 타임아웃날 수 있다.
 * 화면(모달)에서는 대신 /api/schools/sync-public-data-chunk 를 시군구 1곳씩 잘게 나눠 호출한다.
 * 이 라우트는 Vercel Pro 이상이거나 Firebase CLI 등에서 한 번에 처리하고 싶을 때를 위해 남겨둔다.
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
  const levelCodes: string[] =
    Array.isArray(body?.levelCodes) && body.levelCodes.length > 0
      ? body.levelCodes
      : SCHOOLINFO_LEVEL_CODES.map((l) => l.code);
  const sidoCode: string | undefined = body?.sidoCode;

  if (!sidoCode) {
    return NextResponse.json({ error: "시/도를 선택해주세요." }, { status: 400 });
  }

  const db = getAdminDb();
  let matched = 0;
  let matchedByName = 0;
  let unmatched = 0;
  let districtsAttempted = 0;
  let districtsSucceeded = 0;
  let totalRowsFetched = 0;
  let districtSampleError: string | null = null;
  const failedLevels: string[] = [];

  const districts = SIGUNGU_CODES.filter((s) => s.sidoCode === sidoCode && s.sggCode !== "00000");
  const regionHint = districts[0]?.sidoName;

  for (const levelCode of levelCodes) {
    try {
      districtsAttempted += districts.length;
      const districtResults = await mapWithConcurrency(districts, 8, async (d) => {
        try {
          const rows = await fetchSchoolinfoRows(category, year, levelCode, d.sggCode, d.sidoCode);
          districtsSucceeded += 1;
          return rows;
        } catch (err) {
          if (!districtSampleError) districtSampleError = err instanceof Error ? err.message : String(err);
          return [] as SchoolinfoRow[];
        }
      });
      const allRows = districtResults.flat();
      totalRowsFetched += allRows.length;
      const r = await applySchoolinfoRows(db, category, allRows, regionHint);
      matched += r.matched;
      matchedByName += r.matchedByName;
      unmatched += r.unmatched;
    } catch (err) {
      console.error(`schoolinfo sync failed [${category}] for level ${levelCode}`, err);
      failedLevels.push(levelCode);
      if (!districtSampleError) districtSampleError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    category,
    matched,
    matchedByName,
    unmatched,
    failedLevels,
    debug: { districtsAttempted, districtsSucceeded, totalRowsFetched, districtSampleError },
  });
}
