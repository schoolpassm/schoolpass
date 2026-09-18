import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InstitutionDoc } from "@/types";

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
