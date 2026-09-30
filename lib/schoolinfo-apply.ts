import { FieldValue } from "firebase-admin/firestore";
import { extractFieldsForCategory, SCHOOLINFO_LEVEL_CODES, SchoolinfoCategory, SchoolinfoRow } from "@/lib/schoolinfo";

/** 앞뒤 공백, 중간 공백 차이로 인한 매칭 실패를 줄이기 위한 이름 정규화 */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

/**
 * 학교알리미 응답 로우를 schools_detail(+schools_summary)에 반영한다.
 * SCHUL_CODE로 문서ID 직접 매칭을 먼저 시도하고, 실패하면 학교명(+지역)으로 2차 매칭한다.
 * 지역 필터를 포함한 검색에서 못 찾으면, 지역 없이 이름만으로 한 번 더 시도한다
 * (교육지원청 표기가 지역명과 미세하게 다른 경우를 대비).
 *
 * 그래도 못 찾으면(=DB에 아예 없는 학교), "학생수·학급수" 카테고리에 한해 새 학교 문서를
 * 자동 생성한다 — SCHUL_CODE를 문서ID로 써서, 다음 동기화부터는 1차(문서ID) 매칭으로
 * 바로 잡히게 한다(중복 생성 방지). 다른 카테고리는 정보가 빈약한 반쪽 레코드가 생기는 걸
 * 막기 위해 생성하지 않고 기존처럼 건너뛴다 — 스펙 16번(확인 안 된 정보 임의 생성 금지)은
 * 학교알리미 공시자료 자체를 그대로 옮기는 것이라 저촉되지 않는다.
 */
export async function applySchoolinfoRows(
  db: FirebaseFirestore.Firestore,
  category: SchoolinfoCategory,
  rows: SchoolinfoRow[],
  regionHint?: string,
  levelCode?: string
) {
  let matched = 0;
  let matchedByName = 0;
  let created = 0;
  let unmatched = 0;
  const unmatchedSample: string[] = [];
  const createdSample: string[] = [];
  const allowCreate = category === "student_count";
  const levelLabel = SCHOOLINFO_LEVEL_CODES.find((l) => l.code === levelCode)?.label;
  // 배치 1건당 학교 1곳 생성 시 detail+summary 2건씩 쓰기 때문에, Firestore 배치 쓰기 상한(500)
  // 안에서 항상 여유 있게 끝나도록 청크 크기를 기존 300 → 200으로 낮춘다.
  const chunks: (typeof rows)[] = [];
  for (let i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));

  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((row) => db.collection("schools_detail").doc(row.SCHUL_CODE).get()));

    const needsNameLookup: { row: SchoolinfoRow; idx: number }[] = [];
    snaps.forEach((snap, idx) => {
      if (!snap.exists) needsNameLookup.push({ row: chunk[idx], idx });
    });

    const nameLookupResults = await Promise.all(
      needsNameLookup.map(async ({ row }) => {
        const targetName = normalizeName(row.SCHUL_NM);

        // 1차: 이름 + 지역 필터
        if (regionHint) {
          const withRegion = await db
            .collection("schools_summary")
            .where("name", "==", targetName)
            .where("region", "==", regionHint)
            .limit(2)
            .get();
          if (withRegion.size === 1) return withRegion.docs[0].id;
          if (withRegion.size >= 2) return null; // 동명 학교가 같은 지역에 실제로 여럿 — 안전하게 건너뜀
        }

        // 2차: 지역 필터 없이 이름만 (지역 표기 불일치 대비). 결과가 정확히 1건일 때만 채택.
        const nameOnly = await db.collection("schools_summary").where("name", "==", targetName).limit(2).get();
        if (nameOnly.size === 1) return nameOnly.docs[0].id;
        return null;
      })
    );
    const nameMatchMap = new Map<number, string>();
    const toCreate = new Set<number>();
    needsNameLookup.forEach(({ idx, row }, i) => {
      const foundId = nameLookupResults[i];
      if (foundId) nameMatchMap.set(idx, foundId);
      else if (allowCreate && levelLabel && regionHint) toCreate.add(idx);
      else if (unmatchedSample.length < 10) unmatchedSample.push(row.SCHUL_NM);
    });

    const batch = db.batch();
    chunk.forEach((row, idx) => {
      const fields = extractFieldsForCategory(category, row);

      if (toCreate.has(idx)) {
        const newId = row.SCHUL_CODE;
        const name = normalizeName(row.SCHUL_NM);
        const detailDoc: Record<string, unknown> = {
          name,
          region: regionHint,
          level: levelLabel,
          address: "",
          status: "신규",
          grade: "C",
          tags: [],
          syncedFromNeis: true,
          neisSchoolCode: row.SCHUL_CODE,
          lastSyncedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          ...fields,
        };
        batch.set(db.collection("schools_detail").doc(newId), detailDoc, { merge: true });
        const summaryDoc: Record<string, unknown> = {
          id: newId,
          name,
          region: regionHint,
          level: levelLabel,
          status: "신규",
          grade: "C",
          tags: [],
          updatedAt: FieldValue.serverTimestamp(),
        };
        if ("studentCount" in fields) summaryDoc.studentCount = fields.studentCount;
        if ("eduOfficeName" in fields) summaryDoc.eduOfficeName = fields.eduOfficeName;
        batch.set(db.collection("schools_summary").doc(newId), summaryDoc, { merge: true });
        created += 1;
        if (createdSample.length < 10) createdSample.push(row.SCHUL_NM);
        return;
      }

      const docId = snaps[idx].exists ? row.SCHUL_CODE : nameMatchMap.get(idx);
      if (!docId) {
        unmatched += 1;
        return;
      }
      if (Object.keys(fields).length === 0) {
        unmatched += 1;
        return;
      }
      const patch = { ...fields, updatedAt: FieldValue.serverTimestamp() };
      batch.set(db.collection("schools_detail").doc(docId), patch, { merge: true });
      const summaryPatch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if ("studentCount" in fields) summaryPatch.studentCount = fields.studentCount;
      if ("eduOfficeName" in fields) summaryPatch.eduOfficeName = fields.eduOfficeName;
      if ("financeRevenueTotal" in fields) summaryPatch.financeRevenueTotal = fields.financeRevenueTotal;
      if ("developmentFundTotal" in fields) summaryPatch.developmentFundTotal = fields.developmentFundTotal;
      if (Object.keys(summaryPatch).length > 1) {
        batch.set(db.collection("schools_summary").doc(docId), summaryPatch, { merge: true });
      }
      matched += 1;
      if (!snaps[idx].exists) matchedByName += 1;
    });
    await batch.commit();
  }
  return { matched, matchedByName, created, createdSample, unmatched, unmatchedSample };
}
