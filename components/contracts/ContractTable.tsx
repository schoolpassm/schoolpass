"use client";

import { ContractDoc } from "@/types";
import { formatDate, cn } from "@/lib/utils";
import { formatKRW } from "@/lib/commission";
import { updateSettlementStatus } from "@/lib/api/contracts";

const SETTLEMENT_STYLE: Record<ContractDoc["settlementStatus"], string> = {
  정산대기: "bg-gray-100 text-gray-600",
  정산중: "bg-amber-50 text-amber-600",
  정산완료: "bg-emerald-50 text-emerald-600",
};

export function ContractTable({ contracts }: { contracts: ContractDoc[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-white shadow-card">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface-muted text-left text-xs text-ink-500">
            <th className="px-4 py-3 font-medium">학교</th>
            <th className="px-4 py-3 font-medium">계약금액</th>
            <th className="px-4 py-3 font-medium">설치금액</th>
            <th className="px-4 py-3 font-medium">설치일</th>
            <th className="px-4 py-3 font-medium">영업담당</th>
            <th className="px-4 py-3 font-medium">지역파트너</th>
            <th className="px-4 py-3 font-medium">권역</th>
            <th className="px-4 py-3 font-medium">기본수수료</th>
            <th className="px-4 py-3 font-medium">정산상태</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.id} className="border-b border-surface-border last:border-0 hover:bg-surface-muted/60">
              <td className="px-4 py-3 font-medium text-ink-900">{c.schoolName}</td>
              <td className="px-4 py-3 text-ink-700">{formatKRW(c.contractAmount)}</td>
              <td className="px-4 py-3 text-ink-500">{c.installAmount ? formatKRW(c.installAmount) : "-"}</td>
              <td className="px-4 py-3 text-ink-500">{formatDate(c.installDate)}</td>
              <td className="px-4 py-3 text-ink-500">{c.salesOwnerName}</td>
              <td className="px-4 py-3 text-ink-500">{c.partnerName ?? "-"}</td>
              <td className="px-4 py-3 text-ink-500">{c.zone}</td>
              <td className="px-4 py-3 font-semibold text-primary-600">{formatKRW(c.commission.baseCommission)}</td>
              <td className="px-4 py-3">
                <select
                  value={c.settlementStatus}
                  onChange={(e) => updateSettlementStatus(c.id, e.target.value as ContractDoc["settlementStatus"])}
                  className={cn("rounded-full border-0 px-2.5 py-1 text-xs font-medium", SETTLEMENT_STYLE[c.settlementStatus])}
                >
                  <option value="정산대기">정산대기</option>
                  <option value="정산중">정산중</option>
                  <option value="정산완료">정산완료</option>
                </select>
              </td>
            </tr>
          ))}
          {contracts.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-16 text-center text-sm text-ink-300">
                등록된 계약이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
