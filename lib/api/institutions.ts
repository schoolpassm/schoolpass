import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InstitutionDoc } from "@/types";
import { InstitutionRow } from "@/lib/institution-excel";

const COLLECTION = "institutions";

export async function createInstitution(input: Partial<InstitutionDoc>, uid: string) {
  return addDoc(collection(db, COLLECTION), {
    ...input,
    status: input.status ?? "신규",
    grade: input.grade ?? "C",
    tags: input.tags ?? [],
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** 엑셀 일괄 등록: 200건 단위로 배치 커밋 (226개 안팎 규모라 한 배치면 충분하지만, 향후 확장 대비) */
export async function bulkImportInstitutions(rows: InstitutionRow[], uid: string) {
  const chunks: InstitutionRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const row of chunk) {
      if (!row.name) continue;
      const ref = doc(collection(db, COLLECTION));
      const tags = row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      batch.set(ref, {
        name: row.name,
        type: row.type || "시청",
        region: row.region,
        address: row.address,
        phone: row.phone,
        contactName: row.contactName || undefined,
        contactTitle: row.contactTitle || undefined,
        status: row.status || "신규",
        grade: row.grade || "C",
        tags,
        note: row.note,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export async function updateInstitution(id: string, patch: Partial<InstitutionDoc>) {
  return updateDoc(doc(db, COLLECTION, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteInstitution(id: string) {
  return deleteDoc(doc(db, COLLECTION, id));
}

export async function updateInstitutionStatus(id: string, status: InstitutionDoc["status"]) {
  return updateDoc(doc(db, COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

/**
 * 담당자 자동 지정: 이 관공서에 아직 담당자가 없는 상태에서 누군가 전화/이메일/문자/방문을 기록하면
 * 그 사람이 자동으로 담당자가 된다 (학교와 동일한 정책).
 */
export async function addInstitutionActivity(
  institutionId: string,
  activity: { type: "call" | "email" | "sms" | "visit" | "note"; summary: string; authorUid: string; authorName: string }
) {
  const activityRef = await addDoc(collection(db, COLLECTION, institutionId, "activities"), {
    ...activity,
    createdAt: serverTimestamp(),
  });

  if (activity.type === "call" || activity.type === "email" || activity.type === "sms" || activity.type === "visit") {
    const snap = await getDoc(doc(db, COLLECTION, institutionId));
    if (snap.exists() && !snap.data()?.ownerUid) {
      await updateDoc(doc(db, COLLECTION, institutionId), { ownerUid: activity.authorUid, ownerName: activity.authorName });
    }
  }

  return activityRef;
}
