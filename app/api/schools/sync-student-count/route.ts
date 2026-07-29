import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { fetchStudentCounts, SCHOOLINFO_LEVEL_CODES } from "@/lib/schoolinfo";
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

/**
 * 학교알리미 학생수/학급수를 schools_detail(+schools_summary 학생수)에 반영한다.
 * SCHUL_CODE(학교알리미 표준학교코드)가 schools_detail 문서ID(NEIS SD_SCHUL_CODE)와
 * 동일한 표준코드 체계라는 전제로 매칭한다 — 매칭 안 되는 학교(코드 불일치, 수동등록 학교 등)는 건너뛴다.
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

  const db = getAdminDb();
  let matched = 0;
  let unmatched = 0;
  const failedLevels: string[] = [];

  for (const levelCode of levelCodes) {
    try {
      const rows = await fetchStudentCounts(year, levelCode);
      const chunks: (typeof rows)[] = [];
      for (let i = 0; i < rows.length; i += 300) chunks.push(rows.slice(i, i + 300));

      for (const chunk of chunks) {
        // 매칭 확인을 위해 이번 청크 분량만 존재 여부 조회 (전체 스캔 아님)
        const snaps = await Promise.all(chunk.map((row) => db.collection("schools_detail").doc(row.SCHUL_CODE).get()));

        const batch = db.batch();
        chunk.forEach((row, idx) => {
          if (!snaps[idx].exists) {
            unmatched += 1;
            return;
          }
          const studentCount = row.COL_S_SUM ? parseInt(row.COL_S_SUM, 10) : undefined;
          const classCount = row.COL_C_SUM ? parseInt(row.COL_C_SUM, 10) : undefined;
          if (studentCount == null && classCount == null) {
            unmatched += 1;
            return;
          }
          const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
          if (studentCount != null && !isNaN(studentCount)) patch.studentCount = studentCount;
          if (classCount != null && !isNaN(classCount)) patch.classCount = classCount;

          batch.set(db.collection("schools_detail").doc(row.SCHUL_CODE), patch, { merge: true });
          batch.set(
            db.collection("schools_summary").doc(row.SCHUL_CODE),
            { studentCount: patch.studentCount, updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          matched += 1;
        });
        await batch.commit();
      }
    } catch (err) {
      console.error(`schoolinfo student-count sync failed for level ${levelCode}`, err);
      failedLevels.push(levelCode);
    }
  }

  return NextResponse.json({ ok: true, matched, unmatched, failedLevels });
}
