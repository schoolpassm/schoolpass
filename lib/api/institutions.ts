import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, writeBatch, documentId } from "firebase/firestore";
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

/** ancestorPath(id 배열)로 상위기관들의 문서를 한 번에 조회 (breadcrumb 렌더링용, 최대 30개까지 한 쿼리로 처리) */
export async function getInstitutionsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const q = query(collection(db, COLLECTION), where(documentId(), "in", ids.slice(0, 30)));
  const snap = await getDocs(q);
  const byId = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as InstitutionDoc]));
  // 입력받은 순서(루트→직속상위) 그대로 유지해서 반환
  return ids.map((id) => byId.get(id)).filter((v): v is InstitutionDoc => !!v);
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

/**
 * 참고: 여기서 ancestorPath를 다시 계산하는 건 이 기관 자신뿐이다. 이미 하위기관을 거느린 기관을
 * 다른 상위기관 밑으로 옮기는 경우, 그 하위기관들의 ancestorPath는 갱신되지 않는다(캐시가 낡음).
 * 실무에서는 리프(학교/교육지원청 등 말단) 재배치가 대부분이라 지금은 이 한계를 감수하고,
 * 트리 중간 노드를 옮기는 대규모 개편이 필요해지면 하위 전체를 순회하는 별도 함수로 확장한다.
 */
export async function updateInstitution(id: string, patch: Partial<InstitutionDoc>) {
  if (patch.parentInstitutionId === undefined) {
    return updateDoc(doc(db, COLLECTION, id), { ...patch, updatedAt: serverTimestamp() });
  }

  const snap = await getDoc(doc(db, COLLECTION, id));
  const prevParentId = snap.exists() ? (snap.data()?.parentInstitutionId as string | undefined) : undefined;
  const newParentId = patch.parentInstitutionId || undefined;
  const ancestorPath = newParentId ? await getAncestorPath(newParentId) : [];

  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    parentInstitutionId: newParentId ?? deleteField(),
    ancestorPath,
    updatedAt: serverTimestamp(),
  });

  if (prevParentId && prevParentId !== newParentId) {
    await updateDoc(doc(db, COLLECTION, prevParentId), { childCount: increment(-1) });
  }
  if (newParentId && newParentId !== prevParentId) {
    await updateDoc(doc(db, COLLECTION, newParentId), { childCount: increment(1) });
  }
}

export async function deleteInstitution(id: string) {
  return deleteDoc(doc(db, COLLECTION, id));
}

export async function updateInstitutionStatus(id: string, status: InstitutionDoc["status"]) {
  return updateDoc(doc(db, COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

/**
 * 공공영업 확장 파이프라인(16단계) 단계 변경. stageEnteredAt을 매번 새로 찍어서
 * "이 단계에 머문 일수"·14일 정체 판정의 기준으로 삼는다 (lib/public-pipeline.ts 참고).
 * 기존 status(9단계) 필드는 건드리지 않는다 — 완전히 별개 트랙.
 */
export async function updateInstitutionPublicStage(id: string, publicStage: InstitutionDoc["publicStage"]) {
  return updateDoc(doc(db, COLLECTION, id), {
    publicStage,
    stageEnteredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
