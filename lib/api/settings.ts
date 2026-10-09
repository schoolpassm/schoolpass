import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AiDataScopeSettings, SystemSettingsDoc } from "@/types";

const DEFAULT_AI_SCOPE: AiDataScopeSettings = {
  includeContactInfo: true,
  includeBudgetInfo: true,
  includeNotes: true,
};

/** 지시서 7번 — settings/system 단일 문서. 없으면 기본값으로 취급(화면에서 "미설정"처럼 보이지 않게). */
export async function getSystemSettings(): Promise<SystemSettingsDoc> {
  const snap = await getDoc(doc(db, "settings", "system"));
  if (!snap.exists()) {
    return { id: "system", dataRetentionPolicy: "", aiDataScope: DEFAULT_AI_SCOPE, updatedAt: null };
  }
  const data = snap.data();
  return {
    id: "system",
    dataRetentionPolicy: data.dataRetentionPolicy ?? "",
    aiDataScope: { ...DEFAULT_AI_SCOPE, ...(data.aiDataScope ?? {}) },
    updatedAt: data.updatedAt ?? null,
    updatedByName: data.updatedByName,
  };
}

export async function updateSystemSettings(
  patch: Partial<Pick<SystemSettingsDoc, "dataRetentionPolicy" | "aiDataScope">>,
  updatedByName: string
) {
  await setDoc(
    doc(db, "settings", "system"),
    { ...patch, updatedAt: serverTimestamp(), updatedByName },
    { merge: true }
  );
}
