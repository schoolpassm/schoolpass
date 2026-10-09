import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AccessAction } from "@/types";

/**
 * 지시서 7번 "열람·수정 이력" — institutions/schools_detail 상세페이지 접근을
 * {collection}/{id}/access_logs 서브컬렉션에 기록한다. 실패해도 화면 사용을 막지 않도록
 * 호출부는 await 없이 fire-and-forget으로 쓰거나 try/catch로 감싸 쓰는 걸 권장.
 */
export async function logAccess(
  targetCollection: "institutions" | "schools_detail",
  targetId: string,
  action: AccessAction,
  actorUid: string,
  actorName: string,
  extra?: { targetName?: string; changedFields?: string[] }
) {
  try {
    await addDoc(collection(db, targetCollection, targetId, "access_logs"), {
      action,
      targetCollection,
      targetId,
      targetName: extra?.targetName,
      changedFields: extra?.changedFields,
      actorUid,
      actorName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // 열람 로그 실패는 화면 동작을 막지 않는다 (best-effort)
  }
}
