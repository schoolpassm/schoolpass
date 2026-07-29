import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchStudentCounts, SCHOOLINFO_LEVEL_CODES, SchoolinfoStudentCountRow } from "@/lib/schoolinfo";
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

/** n개씩 묶어서 병렬 처리 (요청이 너무 많아 타임아웃 나지 않도록) */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function applyRows(db: FirebaseFirestore.Firestore, rows: SchoolinfoStudentCountRow[], regionHint?: string) {
  let matched = 0;
  let matchedByName = 0;
  let unmatched = 0;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 300) chunks.push(rows.slice(i, i + 300));

  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((row) => db.collection("schools_detail").doc(row.SCHUL_CODE).get()));

    // 1차: SCHUL_CODE로 문서ID 직접 매칭 실패한 것들 모아서 2차: 학교명(+지역)으로 재시도
    // (학교알리미 코드와 NEIS 코드 체계가 달라 코드 매칭이 거의 안 통하는 경우가 있음 — 이름 매칭이 사실상 주 경로)
    // 지역까지 같이 대조해야 동명 학교(전국에 흔한 이름)가 엉뚱하게 매칭되는 것을 막을 수 있다.
    const needsNameLookup: { row: SchoolinfoStudentCountRow; idx: number }[] = [];
    snaps.forEach((snap, idx) => {
      if (!snap.exists) needsNameLookup.push({ row: chunk[idx], idx });
    });

    const nameLookupResults = await Promise.all(
      needsNameLookup.map(async ({ row }) => {
        let q: FirebaseFirestore.Query = db.collection("schools_summary").where("name", "==", row.SCHUL_NM);
        if (regionHint) q = q.where("region", "==", regionHint);
        const snap = await q.limit(2).get();
        // 동명 학교가 2건 이상 걸리면(지역 힌트가 없거나 같은 지역에 동명교가 실제로 있는 경우)
        // 잘못 반영할 위험이 있으니 안전하게 건너뛴다.
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
      const studentCount = row.COL_S_SUM ? parseInt(row.COL_S_SUM, 10) : undefined;
      const classCount = row.COL_C_SUM ? parseInt(row.COL_C_SUM, 10) : undefined;
      if ((studentCount == null || isNaN(studentCount)) && (classCount == null || isNaN(classCount))) {
        unmatched += 1;
        return;
      }
      const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (studentCount != null && !isNaN(studentCount)) patch.studentCount = studentCount;
      if (classCount != null && !isNaN(classCount)) patch.classCount = classCount;

      batch.set(db.collection("schools_detail").doc(docId), patch, { merge: true });
      if (patch.studentCount != null) {
        batch.set(
          db.collection("schools_summary").doc(docId),
          { studentCount: patch.studentCount, updatedAt: FieldValue.serverTimestamp() },
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

/**
 * 학교알리미 학생수/학급수를 schools_detail(+schools_summary 학생수)에 반영한다.
 * 2026년 이후 발급된 인증키는 sggCode(시군구)가 필수라서, 전국(00/00000) 와일드카드를
 * 먼저 시도해보고 비어있으면 선택한 시도(sidoCode)의 모든 시군구를 순회한다.
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
  const year: number = body?.year ?? new Date().getFullYear();
  const levelCodes: string[] =
    Array.isArray(body?.levelCodes) && body.levelCodes.length > 0
      ? body.levelCodes
      : SCHOOLINFO_LEVEL_CODES.map((l) => l.code);
  const sidoCode: string | undefined = body?.sidoCode; // 미지정 시 전국 와일드카드만 시도

  const db = getAdminDb();
  let matched = 0;
  let matchedByName = 0;
  let unmatched = 0;
  let usedWildcard = false;
  let districtsAttempted = 0;
  let districtsSucceeded = 0;
  let totalRowsFetched = 0;
  let sampleError: string | null = null;
  const failedLevels: string[] = [];

  for (const levelCode of levelCodes) {
    // 1) 전국 와일드카드 우선 시도 — 실패해도(신규 키는 대부분 거부됨) 아래 시군구 순회로 계속 진행한다.
    let wildcardWorked = false;
    try {
      const wildcardRows = await fetchStudentCounts(year, levelCode, "00", "00000");
      if (wildcardRows.length > 0) {
        wildcardWorked = true;
        usedWildcard = true;
        totalRowsFetched += wildcardRows.length;
        const r = await applyRows(db, wildcardRows);
        matched += r.matched;
        matchedByName += r.matchedByName;
        unmatched += r.unmatched;
      }
    } catch (err) {
      if (!sampleError) sampleError = err instanceof Error ? err.message : String(err);
    }
    if (wildcardWorked) continue;

    // 2) 와일드카드가 안 통하면 선택한 시도의 시군구를 전부 순회
    if (!sidoCode) continue; // 시도를 안 골랐으면 여기서 중단 (프론트에서 재요청 유도)

    try {
      const districts = SIGUNGU_CODES.filter((s) => s.sidoCode === sidoCode && s.sggCode !== "00000");
      const regionHint = districts[0]?.sidoName; // schools_detail의 region 필드(NEIS 시도명)와 동일한 표기
      districtsAttempted += districts.length;
      const districtResults = await mapWithConcurrency(districts, 8, async (d) => {
        try {
          const rows = await fetchStudentCounts(year, levelCode, d.sidoCode, d.sggCode);
          districtsSucceeded += 1;
          return rows;
        } catch (err) {
          if (!sampleError) sampleError = err instanceof Error ? err.message : String(err);
          return [] as SchoolinfoStudentCountRow[];
        }
      });
      const allRows = districtResults.flat();
      totalRowsFetched += allRows.length;
      const r = await applyRows(db, allRows, regionHint);
      matched += r.matched;
      matchedByName += r.matchedByName;
      unmatched += r.unmatched;
    } catch (err) {
      console.error(`schoolinfo student-count sync failed for level ${levelCode}`, err);
      failedLevels.push(levelCode);
      if (!sampleError) sampleError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    matched,
    matchedByName,
    unmatched,
    failedLevels,
    usedWildcard,
    requiresSido: !usedWildcard && !sidoCode,
    debug: { districtsAttempted, districtsSucceeded, totalRowsFetched, sampleError },
  });
}
