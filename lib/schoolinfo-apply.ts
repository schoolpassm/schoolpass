import { FieldValue } from "firebase-admin/firestore";
import { extractFieldsForCategory, SchoolinfoCategory, SchoolinfoRow } from "@/lib/schoolinfo";

/**
 * 학교알리미 응답 로우를 schools_detail(+schools_summary)에 반영한다.
 * SCHUL_CODE로 문서ID 직접 매칭을 먼저 시도하고, 실패하면 학교명(+지역)으로 2차 매칭한다.
 */
export async function applySchoolinfoRows(
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
