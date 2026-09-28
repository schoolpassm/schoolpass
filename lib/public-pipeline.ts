import { Timestamp } from "firebase/firestore";
import { InstitutionDoc, PublicPipelineStage, PUBLIC_PIPELINE_STAGES } from "@/types";

/** 칸반 컬럼 순서(진행 중 단계만, 스펙 4번) + 드롭다운에서 고를 수 있는 종결 단계 2개 */
export const ALL_PUBLIC_STAGES: PublicPipelineStage[] = [...PUBLIC_PIPELINE_STAGES, "보류", "종료"];

/** 종결 단계 — 여기서는 "정체"를 따지지 않는다 (이미 끝났거나 보류 중이므로) */
const TERMINAL_STAGES: PublicPipelineStage[] = ["계약완료", "보류", "종료"];

export const STALL_THRESHOLD_DAYS = 14;

const ACCENT: Record<PublicPipelineStage, string> = {
  조사: "border-t-gray-400",
  대상기관선정: "border-t-gray-400",
  담당부서확인: "border-t-primary-400",
  담당자확인: "border-t-primary-500",
  최초접촉: "border-t-violet-500",
  자료전달: "border-t-violet-500",
  미팅: "border-t-amber-500",
  제품시연: "border-t-sky-500",
  시범사업검토: "border-t-sky-600",
  내부검토: "border-t-orange-500",
  예산검토: "border-t-orange-500",
  조달검토: "border-t-yellow-500",
  계약협의: "border-t-yellow-600",
  계약완료: "border-t-emerald-500",
  보류: "border-t-gray-300",
  종료: "border-t-red-400",
};

export function stageAccent(stage: PublicPipelineStage): string {
  return ACCENT[stage] ?? "border-t-gray-400";
}

/** 기관의 현재 공공영업 파이프라인 단계. 아직 한 번도 지정 안 됐으면 첫 단계("조사")로 취급한다 — 일괄 백필 불필요. */
export function getPublicStage(institution: Pick<InstitutionDoc, "publicStage">): PublicPipelineStage {
  return institution.publicStage ?? "조사";
}

function toDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
}

/**
 * 현재 단계에 머문 일수. stageEnteredAt이 없는 기존 기관(한 번도 단계 이동을 안 한 경우)은
 * updatedAt을 대신 기준으로 쓴다 — 정확한 단계 진입 시각은 아니지만 "최소 이만큼은 정체됐다"는
 * 합리적인 추정치로 삼는다.
 */
export function getDaysInStage(institution: Pick<InstitutionDoc, "stageEnteredAt" | "updatedAt">): number | null {
  const base = toDate(institution.stageEnteredAt) ?? toDate(institution.updatedAt);
  if (!base) return null;
  return Math.floor((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24));
}

/** 14일 이상 정체 여부 (종결 단계는 제외 — 계약완료/보류/종료는 애초에 "정체"라는 개념이 없음) */
export function isStalled(institution: Pick<InstitutionDoc, "publicStage" | "stageEnteredAt" | "updatedAt">): boolean {
  const stage = getPublicStage(institution);
  if (TERMINAL_STAGES.includes(stage)) return false;
  const days = getDaysInStage(institution);
  return days !== null && days >= STALL_THRESHOLD_DAYS;
}
