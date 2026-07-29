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

async function applyRows(db: FirebaseFirestore.Firestore, rows: SchoolinfoStudentCountRow[]) {
  let matched = 0;
  let unmatched = 0;
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 300) chunks.push(rows.slice(i, i + 300));

  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((row) => db.collection("schools_detail").doc(row.SCHUL_CODE).get()));
    const batch = db.batch();
    chunk.forEach((row, idx) => {
      if (!snaps[idx].exists) {
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

      batch.set(db.collection("schools_detail").doc(row.SCHUL_CODE), patch, { merge: true });
      if (patch.studentCount != null) {
        batch.set(
          db.collection("schools_summary").doc(row.SCHUL_CODE),
          { studentCount: patch.studentCount, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      matched += 1;
    });
    await batch.commit();
  }
  return { matched, unmatched };
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
  let unmatched = 0;
  let usedWildcard = false;
  const failedLevels: string[] = [];

  for (const levelCode of levelCodes) {
    try {
      // 1) 전국 와일드카드 우선 시도 (구식 인증키는 이걸로 끝남)
      const wildcardRows = await fetchStudentCounts(year, levelCode, "00", "00000");
      if (wildcardRows.length > 0) {
        usedWildcard = true;
        const r = await applyRows(db, wildcardRows);
        matched += r.matched;
        unmatched += r.unmatched;
        continue;
      }

      // 2) 와일드카드가 비어있으면 (신규 인증키) 선택한 시도의 시군구를 전부 순회
      if (!sidoCode) continue; // 시도를 안 골랐으면 여기서 중단 (프론트에서 재요청 유도)

      const districts = SIGUNGU_CODES.filter((s) => s.sidoCode === sidoCode && s.sggCode !== "00000");
      const districtResults = await mapWithConcurrency(districts, 8, async (d) => {
        try {
          return await fetchStudentCounts(year, levelCode, d.sidoCode, d.sggCode);
        } catch {
          return [] as SchoolinfoStudentCountRow[];
        }
      });
      const allRows = districtResults.flat();
      const r = await applyRows(db, allRows);
      matched += r.matched;
      unmatched += r.unmatched;
    } catch (err) {
      console.error(`schoolinfo student-count sync failed for level ${levelCode}`, err);
      failedLevels.push(levelCode);
    }
  }

  return NextResponse.json({
    ok: true,
    matched,
    unmatched,
    failedLevels,
    usedWildcard,
    requiresSido: !usedWildcard && !sidoCode,
  });
}
