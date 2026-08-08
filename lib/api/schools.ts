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
import { SchoolDoc, SchoolActivityDoc, SchoolQuoteDoc, SchoolSummaryDoc } from "@/types";
import { SchoolRow } from "@/lib/excel";

/**
 * 데이터 구조 (성능 최적화)
 * ---------------------------------------------------------------------------
 * schools_detail/{id}  — 전체 상세 문서 (Source of Truth). 상세페이지에서만 조회.
 * schools_summary/{id} — 목록/지도/칸반 전용 경량 사본. 동일 문서ID 유지.
 *
 * 이 파일의 모든 쓰기 함수는 두 컬렉션을 하나의 배치(batch)로 함께 갱신해
 * 데이터 불일치가 생기지 않도록 한다. 절대로 schools_detail 전체를 목록/지도에서
 * 조회하지 말 것 — 반드시 schools_summary만 사용한다.
 * ---------------------------------------------------------------------------
 */

const DETAIL = "schools_detail";
const SUMMARY = "schools_summary";

function toSummaryFields(input: Partial<SchoolDoc>): Partial<SchoolSummaryDoc> {
  const summary: Partial<SchoolSummaryDoc> = {};
  if (input.name !== undefined) summary.name = input.name;
  if (input.region !== undefined) summary.region = input.region;
  if (input.district !== undefined) summary.district = input.district;
  if (input.level !== undefined) summary.level = input.level;
  if (input.status !== undefined) summary.status = input.status;
  if (input.grade !== undefined) summary.grade = input.grade;
  if (input.lat !== undefined) summary.lat = input.lat;
  if (input.lng !== undefined) summary.lng = input.lng;
  if (input.address !== undefined) summary.address = input.address;
  if (input.phone !== undefined) summary.phone = input.phone;
  if (input.email !== undefined) summary.email = input.email;
  if (input.contactName !== undefined) summary.contactName = input.contactName;
  if (input.contactPhone !== undefined) summary.contactPhone = input.contactPhone;
  if (input.contactEmail !== undefined) summary.contactEmail = input.contactEmail;
  if (input.studentCount !== undefined) summary.studentCount = input.studentCount;
  if (input.ownerName !== undefined) summary.ownerName = input.ownerName;
  if (input.partnerId !== undefined) summary.partnerId = input.partnerId;
  if (input.eduOfficeId !== undefined) summary.eduOfficeId = input.eduOfficeId;
  if (input.tags !== undefined) summary.tags = input.tags;
  if (input.isNewlyOpened !== undefined) summary.isNewlyOpened = input.isNewlyOpened;
  if (input.aiScore !== undefined) summary.aiScore = input.aiScore;
  return summary;
}

export async function createSchool(input: Partial<SchoolDoc>, uid: string) {
  const detailRef = doc(collection(db, DETAIL));
  const detailData = {
    ...input,
    tags: input.tags ?? [],
    status: input.status ?? "신규",
    grade: input.grade ?? "C",
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  };

  const batch = writeBatch(db);
  batch.set(detailRef, detailData);
  batch.set(doc(db, SUMMARY, detailRef.id), {
    ...toSummaryFields(detailData as Partial<SchoolDoc>),
    tags: detailData.tags,
    status: detailData.status,
    grade: detailData.grade,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return detailRef;
}

export async function updateSchool(schoolId: string, patch: Partial<SchoolDoc>) {
  const batch = writeBatch(db);
  batch.update(doc(db, DETAIL, schoolId), { ...patch, updatedAt: serverTimestamp() });
  const summaryPatch = toSummaryFields(patch);
  if (Object.keys(summaryPatch).length > 0) {
    batch.set(doc(db, SUMMARY, schoolId), { ...summaryPatch, updatedAt: serverTimestamp() }, { merge: true });
  }
  return batch.commit();
}

export async function deleteSchool(schoolId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, DETAIL, schoolId));
  batch.delete(doc(db, SUMMARY, schoolId));
  return batch.commit();
}

export async function updateSchoolStatus(schoolId: string, status: SchoolDoc["status"], uid: string, uidName: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, DETAIL, schoolId), { status, updatedAt: serverTimestamp() });
  batch.set(doc(db, SUMMARY, schoolId), { status, updatedAt: serverTimestamp() }, { merge: true });
  const activityRef = doc(collection(db, DETAIL, schoolId, "activities"));
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
  const batch = writeBatch(db);
  const activityRef = doc(collection(db, DETAIL, schoolId, "activities"));
  batch.set(activityRef, {
    ...activity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // 최근 접촉일 갱신 ("이번주 전화 대상" 계산에 사용) — 상세/요약 컬렉션 동시 갱신
  if (activity.type === "call" || activity.type === "email" || activity.type === "sms" || activity.type === "visit") {
    batch.update(doc(db, DETAIL, schoolId), { lastContactedAt: serverTimestamp() });
    batch.set(doc(db, SUMMARY, schoolId), { lastContactedAt: serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  return activityRef;
}

export async function addSchoolQuote(schoolId: string, quote: Partial<SchoolQuoteDoc>) {
  return addDoc(collection(db, DETAIL, schoolId, "quotes"), {
    ...quote,
    status: quote.status ?? "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** 엑셀 일괄 업로드: 200건 단위로 배치 커밋 (schools_detail + schools_summary 동시 기록) */
export async function bulkImportSchools(rows: SchoolRow[], uid: string) {
  const chunks: SchoolRow[][] = [];
  for (let i = 0; i < rows.length; i += 200) chunks.push(rows.slice(i, i + 200));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const row of chunk) {
      if (!row.name) continue;
      const detailRef = doc(collection(db, DETAIL));
      const tags = row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      const status = row.status || "신규";
      const grade = row.grade || "C";
      batch.set(detailRef, {
        name: row.name,
        region: row.region,
        level: row.level,
        address: row.address,
        phone: row.phone,
        adminOfficePhone: row.adminOfficePhone,
        email: row.email,
        studentCount: row.studentCount,
        ownerName: row.ownerName,
        status,
        grade,
        tags,
        note: row.note,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });
      batch.set(doc(db, SUMMARY, detailRef.id), {
        name: row.name,
        region: row.region,
        level: row.level,
        address: row.address,
        phone: row.phone,
        studentCount: row.studentCount,
        ownerName: row.ownerName,
        status,
        grade,
        tags,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
