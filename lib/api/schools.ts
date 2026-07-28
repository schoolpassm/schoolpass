import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolDoc, SchoolActivityDoc, SchoolQuoteDoc } from "@/types";
import { SchoolRow } from "@/lib/excel";

export async function createSchool(input: Partial<SchoolDoc>, uid: string) {
  return addDoc(collection(db, "schools"), {
    ...input,
    tags: input.tags ?? [],
    status: input.status ?? "신규",
    grade: input.grade ?? "C",
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}

export async function updateSchool(schoolId: string, patch: Partial<SchoolDoc>) {
  return updateDoc(doc(db, "schools", schoolId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSchool(schoolId: string) {
  return deleteDoc(doc(db, "schools", schoolId));
}

export async function updateSchoolStatus(schoolId: string, status: SchoolDoc["status"], uid: string, uidName: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, "schools", schoolId), { status, updatedAt: serverTimestamp() });
  const activityRef = doc(collection(db, "schools", schoolId, "activities"));
  batch.set(activityRef, {
    type: "status_change",
    summary: `상태 변경: ${status}`,
    authorUid: uid,
    authorName: uidName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return batch.commit();
}

export async function addSchoolActivity(schoolId: string, activity: Partial<SchoolActivityDoc>) {
  return addDoc(collection(db, "schools", schoolId, "activities"), {
    ...activity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function addSchoolQuote(schoolId: string, quote: Partial<SchoolQuoteDoc>) {
  return addDoc(collection(db, "schools", schoolId, "quotes"), {
    ...quote,
    status: quote.status ?? "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** 엑셀 일괄 업로드: 500건 단위로 배치 커밋 (Firestore batch 제한 대응) */
export async function bulkImportSchools(rows: SchoolRow[], uid: string) {
  const chunks: SchoolRow[][] = [];
  for (let i = 0; i < rows.length; i += 400) chunks.push(rows.slice(i, i + 400));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const row of chunk) {
      if (!row.name) continue;
      const ref = doc(collection(db, "schools"));
      batch.set(ref, {
        name: row.name,
        region: row.region,
        level: row.level,
        address: row.address,
        phone: row.phone,
        adminOfficePhone: row.adminOfficePhone,
        email: row.email,
        studentCount: row.studentCount,
        ownerName: row.ownerName,
        status: row.status || "신규",
        grade: row.grade || "C",
        tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        note: row.note,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });
    }
    await batch.commit();
  }
}
