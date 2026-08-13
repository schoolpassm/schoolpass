import { CommissionBreakdown, CommissionCalcMethod, SchoolPassProduct } from "@/types";

/**
 * 수익 자동계산 규칙 — ㈜바른정보기술 공식 수수료 규정 (2026.07) 기준
 * -------------------------------------------------------------------------
 * 제품 단가 (부가세 포함, 산정 기준):
 *   제로패스(zero_pass): 18,700,000원
 *   스쿨패스(school_pass): 17,200,000원
 *
 * 방식1. 단위 수량 판매 방식 (누적 집계, 집계 기한 없음)
 *   - 누적 판매 대수 1~10대: 대당 20% 수수료
 *   - 11대째부터(10대 초과분): 대당 25% 수수료
 *   - "누적"이므로 이번 계약 이전에 이미 판매된 대수를 감안해서 구간을 나눈다.
 *
 * 방식2. 사업 예산 방식 (건별 적용, 다른 건과 합산되지 않음)
 *   - 단위(대수) 판매 규모: 25%
 *   - 10억원 이상 ~ 50억원 미만: 32%
 *   - 50억원 이상: 36%
 *   - 건 전체 금액에 단일 요율을 적용한다.
 *
 * 수수료는 부가세, 대리점 유통 마진, 설치 공사비를 제외한 "순수 제품 공급가" 기준.
 * -------------------------------------------------------------------------
 */

export const PRODUCT_LABEL: Record<SchoolPassProduct, string> = {
  zero_pass: "제로패스(ZERO-PASS)",
  school_pass: "스쿨패스(School-PASS)",
};

/** 제품 단가 (부가세 포함, 공식 산정 기준가) */
export const PRODUCT_UNIT_PRICE: Record<SchoolPassProduct, number> = {
  zero_pass: 18_700_000,
  school_pass: 17_200_000,
};

const UNIT_TIER_THRESHOLD = 10; // 이 대수까지는 낮은 요율
const UNIT_RATE_LOW = 0.2; // 1~10대
const UNIT_RATE_HIGH = 0.25; // 11대~

const PROJECT_RATE_BASE = 0.25; // 단순 대수 판매 규모
const PROJECT_RATE_MID = 0.32; // 10억 이상 ~ 50억 미만
const PROJECT_RATE_HIGH = 0.36; // 50억 이상
const PROJECT_MID_THRESHOLD = 1_000_000_000;
const PROJECT_HIGH_THRESHOLD = 5_000_000_000;

/**
 * 방식1: 단위 수량 판매 방식 (누적 집계).
 * previousCumulativeUnits: 이 계약 이전까지 이미 판매된 누적 대수(같은 제품 기준, 전체 계약 합산)
 * thisContractUnits: 이번 계약에서 판매하는 대수
 */
export function calcUnitBasedCommission(
  product: SchoolPassProduct,
  previousCumulativeUnits: number,
  thisContractUnits: number
): CommissionBreakdown {
  const unitPrice = PRODUCT_UNIT_PRICE[product];
  const tierBreakdown: { units: number; rate: number; amount: number }[] = [];
  let remaining = Math.max(0, thisContractUnits);
  let cursor = Math.max(0, previousCumulativeUnits);

  const unitsInLowTier = Math.max(0, Math.min(remaining, UNIT_TIER_THRESHOLD - cursor));
  if (unitsInLowTier > 0) {
    tierBreakdown.push({ units: unitsInLowTier, rate: UNIT_RATE_LOW, amount: Math.round(unitsInLowTier * unitPrice * UNIT_RATE_LOW) });
    remaining -= unitsInLowTier;
    cursor += unitsInLowTier;
  }
  if (remaining > 0) {
    tierBreakdown.push({ units: remaining, rate: UNIT_RATE_HIGH, amount: Math.round(remaining * unitPrice * UNIT_RATE_HIGH) });
  }

  const totalCommission = tierBreakdown.reduce((sum, t) => sum + t.amount, 0);
  const dealAmount = thisContractUnits * unitPrice;

  return { method: "unit", product, unitCount: thisContractUnits, dealAmount, tierBreakdown, totalCommission };
}

/**
 * 방식2: 사업 예산 방식 (건별, 비누적). dealAmount는 이 사업(건)의 총 판매금액(부가세 포함).
 */
export function calcProjectBasedCommission(product: SchoolPassProduct, dealAmount: number): CommissionBreakdown {
  let rate: number;
  if (dealAmount >= PROJECT_HIGH_THRESHOLD) rate = PROJECT_RATE_HIGH;
  else if (dealAmount >= PROJECT_MID_THRESHOLD) rate = PROJECT_RATE_MID;
  else rate = PROJECT_RATE_BASE;

  const totalCommission = Math.round(dealAmount * rate);
  return { method: "project", product, dealAmount, appliedRate: rate, totalCommission };
}

/**
 * 계약 등록 폼 등에서 공용으로 쓰는 진입점.
 * method가 "unit"이면 previousCumulativeUnits가 필요하고(호출 전에 기존 계약들에서 집계해서 넘겨야 함),
 * method가 "project"이면 dealAmount만 있으면 된다.
 */
export function calculateCommission(params: {
  method: CommissionCalcMethod;
  product: SchoolPassProduct;
  unitCount?: number;
  previousCumulativeUnits?: number;
  dealAmount?: number;
}): CommissionBreakdown {
  if (params.method === "unit") {
    return calcUnitBasedCommission(params.product, params.previousCumulativeUnits ?? 0, params.unitCount ?? 0);
  }
  return calcProjectBasedCommission(params.product, params.dealAmount ?? 0);
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(amount);
}
