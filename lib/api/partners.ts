import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PartnerDoc } from "@/types";

export async function createPartner(input: Partial<PartnerDoc>, uid: string) {
  return addDoc(collection(db, "partners"), {
    ...input,
    referralCount: 0,
    contractCount: 0,
    totalRevenue: 0,
    totalCommission: 0,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}

export async function updatePartner(id: string, patch: Partial<PartnerDoc>) {
  return updateDoc(doc(db, "partners", id), { ...patch, updatedAt: serverTimestamp() });
}
