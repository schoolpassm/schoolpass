import { Timestamp } from "firebase/firestore";
import { UnifiedPipelineStage, UNIFIED_PIPELINE_STAGES, UNIFIED_PIPELINE_TERMINAL_STAGES } from "@/types";

/**
 * ZeroPass 통합 확장(2026.10 지시서 3번)의 통합 16단계 파이프라인 — institutions와 schools
 * 양쪽에서 공통으로 쓴다(지시서 15번 "공통 CRM 엔진" 원칙). 기존 SchoolStatus(학교 9단계)·
 * PublicPipelineStage(공공기관 16단계)는 그대로 남겨두고, 이 모듈은 새 salesStage 필드 전용이다.
 */

export const ALL_UNIFIED_STAGES: UnifiedPipelineStage[] = [...UNIFIED_PIPELINE_STAGES, "보류", "실패"];
export const STALL_THRESHOLD_DAYS = 14;

const ACCENT: Record<UnifiedPipelineStage, string> = {
  신규: "border-t-gray-400",
  담당자확인: "border-t-primary-400",
  전화완료: "border-t-primary-500",
  자료발송: "border-t-violet-500",
  방문예정: "border-t-violet-500",
  시연예정: "border-t-amber-500",
  시연완료: "border-t-amber-600",
  견적: "border-t-sky-500",
  내부검토협의: "border-t-sky-600",
  예산검토: "border-t-orange-500",
  보안검토: "border-t-orange-600",
  조달검토: "border-t-yellow-500",
  계약: "border-t-yellow-600",
  설치구축: "border-t-emerald-500",
  운영중: "border-t-emerald-600",
  보류: "border-t-gray-300",
  실패: "border-t-red-400",
};

export function salesStageAccent(stage: UnifiedPipelineStage): string {
  return ACCENT[stage] ?? "border-t-gray-400";
}

/** 현재 통합 파이프라인 단계. 한 번도 지정 안 됐으면 "신규"로 취급한다 — 일괄 백필 불필요. */
export function getSalesStage(doc: { salesStage?: UnifiedPipelineStage }): UnifiedPipelineStage {
  return doc.salesStage ?? "신규";
}

function toDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
}

/** 현재 단계 체류일수. salesStageEnteredAt이 없으면 updatedAt을 대신 기준으로 쓴다(최소 정체 추정치). */
export function getDaysInSalesStage(doc: {
  salesStageEnteredAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}): number | null {
  const base = toDate(doc.salesStageEnteredAt) ?? toDate(doc.updatedAt);
  if (!base) return null;
  return Math.floor((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24));
}

/** 14일 이상 정체 여부 (종결 단계 제외) — 지시서 4번과 동일한 "단계별 체류기간" 원칙을 통합 파이프라인에도 적용 */
export function isSalesStalled(doc: {
  salesStage?: UnifiedPipelineStage;
  salesStageEnteredAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}): boolean {
  const stage = getSalesStage(doc);
  if (UNIFIED_PIPELINE_TERMINAL_STAGES.includes(stage)) return false;
  const days = getDaysInSalesStage(doc);
  return days !== null && days >= STALL_THRESHOLD_DAYS;
}
