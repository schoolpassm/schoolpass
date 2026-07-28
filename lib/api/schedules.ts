import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScheduleDoc } from "@/types";

export async function createSchedule(input: Partial<ScheduleDoc>, uid: string) {
  return addDoc(collection(db, "schedules"), {
    ...input,
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}

export async function toggleScheduleDone(id: string, done: boolean) {
  return updateDoc(doc(db, "schedules", id), { done, updatedAt: serverTimestamp() });
}
