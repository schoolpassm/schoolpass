import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InstitutionActivityDoc, InstitutionContactDoc, InstitutionDoc, InstitutionDocumentDoc } from "@/types";
import { InstitutionRow } from "@/lib/institution-excel";

const COLLECTION = "institutions";

export async function createInstitution(input: Partial<InstitutionDoc>, uid: string) {
  const ancestorPath = input.parentInstitutionId ? await getAncestorPath(input.parentInstitutionId) : [];
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    status: input.status ?? "신규",
    grade: input.grade ?? "C",
    tags: input.tags ?? [],
    ancestorPath,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (input.parentInstitutionId) {
    await updateDoc(doc(db, COLLECTION, input.parentInstitutionId), { childCount: increment(1) });
  }
  return ref;
}

/** 상위기관의 ancestorPath + 자기자신 id를 이어붙여 새 기관의 ancestorPath를 만든다 (breadcrumb·하위전체조회 캐시용). */
async function getAncestorPath(parentInstitutionId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, COLLECTION, parentInstitutionId));
  if (!snap.exists()) return [];
  const parentAncestorPath = (snap.data()?.ancestorPath as string[] | undefined) ?? [];
  return [...parentAncestorPath, parentInstitutionId];
}

/** 특정 기관의 직속 하위기관 목록 (예: 교육지원청 하나의 관할 학교/하위기관 조회) */
export async function getChildInstitutions(parentInstitutionId: string) {
  const q = query(collection(db, COLLECTION), where("parentInstitutionId", "==", parentInstitutionId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InstitutionDoc);
}

// ----------------------------------------------------------------------------
// institutions/{id}/contacts — 담당자 다중관리
// ----------------------------------------------------------------------------
export async function addInstitutionContact(institutionId: string, input: Partial<InstitutionContactDoc>, uid: string) {
  return addDoc(collection(db, COLLECTION, institutionId, "contacts"), {
    ...input,
    active: input.active ?? true,
    contactCount: input.contactCount ?? 0,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateInstitutionContact(institutionId: string, contactId: string, patch: Partial<InstitutionContactDoc>) {
  return updateDoc(doc(db, COLLECTION, institutionId, "contacts", contactId), { ...patch, updatedAt: serverTimestamp() });
}

/** 담당자 퇴사/교체 시 삭제 대신 비활성화 (이력 보존, 스펙 7번) */
export async function deactivateInstitutionContact(institutionId: string, contactId: string) {
  return updateDoc(doc(db, COLLECTION, institutionId, "contacts", contactId), { active: false, updatedAt: serverTimestamp() });
}

// ----------------------------------------------------------------------------
// institutions/{id}/documents — 정책·공문 CRM
// ----------------------------------------------------------------------------
export async function addInstitutionDocument(institutionId: string, input: Partial<InstitutionDocumentDoc>, uid: string) {
  return addDoc(collection(db, COLLECTION, institutionId, "documents"), {
    ...input,
    institutionResponded: input.institutionResponded ?? false,
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
export async function addInstitutionActivity(institutionId: string, activity: Partial<InstitutionActivityDoc> & { authorUid: string; authorName: string; summary: string }) {
  const type = activity.type ?? "call";
  const activityRef = await addDoc(collection(db, COLLECTION, institutionId, "activities"), {
    ...activity,
    type,
    createdAt: serverTimestamp(),
  });

  // 담당자 자동 지정 정책 유지 (학교와 동일)
  if (["call", "email", "sms", "visit", "kakao", "online_meeting", "demo"].includes(type)) {
    const snap = await getDoc(doc(db, COLLECTION, institutionId));
    if (snap.exists() && !snap.data()?.ownerUid) {
      await updateDoc(doc(db, COLLECTION, institutionId), { ownerUid: activity.authorUid, ownerName: activity.authorName });
    }
    await updateDoc(doc(db, COLLECTION, institutionId), { lastContactedAt: serverTimestamp() });
  }

  // 특정 담당자와의 접촉이면 그 담당자의 접촉횟수/최근접촉일도 갱신
  if (activity.contactId) {
    await updateDoc(doc(db, COLLECTION, institutionId, "contacts", activity.contactId), {
      contactCount: increment(1),
      lastContactedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return activityRef;
}
