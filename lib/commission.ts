import { CommissionBreakdown, CommissionZone } from "@/types";

/**
 * 수익 자동계산 규칙
 * -------------------------------------------------------------------------
 * 기본수수료: 계약금액의 35%
 * 권역별 배분율 (기본수수료 35% 안에서의 배분 비율, 합계는 항상 35):
 *
 *   공동권역: 본인 10 / 사촌 10 / 영업 10 / 운영비 5
 *   신규권역: 본인 11 / 사촌  9 / 영업 10 / 운영비 5
 *   사촌권역: 본인  9 / 사촌 11 / 영업 10 / 운영비 5
 *
 * 배분율 숫자는 "계약금액 대비 %"로 해석한다.
 * 즉 공동권역에서 계약금액 1,000만원이면:
 *   본인 100만원(10%) / 사촌 100만원(10%) / 영업 100만원(10%) / 운영비 50만원(5%)
 *   합계 350만원(35%) = 기본수수료와 일치
 * -------------------------------------------------------------------------
 */

export const BASE_COMMISSION_RATE = 0.35;

interface ZoneRateTable {
  selfRate: number;
  cousinRate: number;
  salesRate: number;
  operationRate: number;
}

export const ZONE_RATES: Record<CommissionZone, ZoneRateTable> = {
  공동권역: { selfRate: 0.10, cousinRate: 0.10, salesRate: 0.10, operationRate: 0.05 },
  신규권역: { selfRate: 0.11, cousinRate: 0.09, salesRate: 0.10, operationRate: 0.05 },
  사촌권역: { selfRate: 0.09, cousinRate: 0.11, salesRate: 0.10, operationRate: 0.05 },
};

/** 계약금액과 권역을 입력하면 수수료 배분 내역을 계산해 반환한다. */
export function calculateCommission(
  contractAmount: number,
  zone: CommissionZone
): CommissionBreakdown {
  const rates = ZONE_RATES[zone];
  const round = (n: number) => Math.round(n);

  const self = round(contractAmount * rates.selfRate);
  const cousin = round(contractAmount * rates.cousinRate);
  const sales = round(contractAmount * rates.salesRate);
  const operation = round(contractAmount * rates.operationRate);
  const baseCommission = round(contractAmount * BASE_COMMISSION_RATE);

  return {
    baseRate: BASE_COMMISSION_RATE,
    baseCommission,
    zone,
    self,
    cousin,
    sales,
    operation,
    selfRate: rates.selfRate,
    cousinRate: rates.cousinRate,
    salesRate: rates.salesRate,
    operationRate: rates.operationRate,
  };
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(
    amount
  );
}
