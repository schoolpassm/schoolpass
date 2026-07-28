import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EducationOfficeDoc, EduOfficeEventDoc } from "@/types";

export async function createEduOffice(input: Partial<EducationOfficeDoc>, uid: string) {
  return addDoc(collection(db, "educationOffices"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}

export async function updateEduOffice(id: string, patch: Partial<EducationOfficeDoc>) {
  return updateDoc(doc(db, "educationOffices", id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteEduOffice(id: string) {
  return deleteDoc(doc(db, "educationOffices", id));
}

export async function addEduOfficeEvent(eduOfficeId: string, event: Partial<EduOfficeEventDoc>) {
  return addDoc(collection(db, "educationOffices", eduOfficeId, "events"), {
    ...event,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
