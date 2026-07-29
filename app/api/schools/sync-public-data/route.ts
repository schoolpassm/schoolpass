import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  fetchSchoolinfoRows,
  extractFieldsForCategory,
  SCHOOLINFO_LEVEL_CODES,
  SCHOOLINFO_CATEGORIES,
  SchoolinfoCategory,
  SchoolinfoRow,
} from "@/lib/schoolinfo";
import { SIGUNGU_CODES } from "@/lib/schoolinfo-regions";
import { FieldValue } from "firebase-admin/firestore";

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

async function applyRows(
  db: FirebaseFirestore.Firestore,
  category: SchoolinfoCategory,
  rows: SchoolinfoRow[],
  regionHint?: string
) {
  let matched = 0;
  let matchedByName = 0;
  let unmatched = 0;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 300) chunks.push(rows.slice(i, i + 300));

  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((row) => db.collection("schools_detail").doc(row.SCHUL_CODE).get()));

    const needsNameLookup: { row: SchoolinfoRow; idx: number }[] = [];
    snaps.forEach((snap, idx) => {
      if (!snap.exists) needsNameLookup.push({ row: chunk[idx], idx });
    });

    const nameLookupResults = await Promise.all(
      needsNameLookup.map(async ({ row }) => {
        let q: FirebaseFirestore.Query = db.collection("schools_summary").where("name", "==", row.SCHUL_NM);
        if (regionHint) q = q.where("region", "==", regionHint);
        const snap = await q.limit(2).get();
        if (snap.size !== 1) return null;
        return snap.docs[0].id;
      })
    );
    const nameMatchMap = new Map<number, string>();
    needsNameLookup.forEach(({ idx }, i) => {
      const foundId = nameLookupResults[i];
      if (foundId) nameMatchMap.set(idx, foundId);
    });

    const batch = db.batch();
    chunk.forEach((row, idx) => {
      const docId = snaps[idx].exists ? row.SCHUL_CODE : nameMatchMap.get(idx);
      if (!docId) {
        unmatched += 1;
        return;
      }
      const fields = extractFieldsForCategory(category, row);
      if (Object.keys(fields).length === 0) {
        unmatched += 1;
        return;
      }
      const patch = { ...fields, updatedAt: FieldValue.serverTimestamp() };
      batch.set(db.collection("schools_detail").doc(docId), patch, { merge: true });
      if ("studentCount" in fields) {
        batch.set(
          db.collection("schools_summary").doc(docId),
          { studentCount: fields.studentCount, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      matched += 1;
      if (!snaps[idx].exists) matchedByName += 1;
    });
    await batch.commit();
  }
  return { matched, matchedByName, unmatched };
}

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
      const r = await applyRows(db, category, allRows, regionHint);
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
