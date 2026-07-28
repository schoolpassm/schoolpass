"use client";

import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/lib/hooks/useCollection";
import { SchoolQuoteDoc } from "@/types";
import { addSchoolQuote } from "@/lib/api/schools";
import { formatDate, cn } from "@/lib/utils";
import { formatKRW } from "@/lib/commission";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STATUS_STYLE: Record<SchoolQuoteDoc["status"], string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-primary-50 text-primary-600",
  accepted: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-500",
};
const STATUS_LABEL: Record<SchoolQuoteDoc["status"], string> = {
  draft: "작성중",
  sent: "발송완료",
  accepted: "수락",
  rejected: "거절",
};

export function QuotesTab({ schoolId }: { schoolId: string }) {
  const { data: quotes, loading } = useCollection<SchoolQuoteDoc>(`schools_detail/${schoolId}/quotes`, [
    orderBy("createdAt", "desc"),
  ]);
  const [amount, setAmount] = useState("");
  const [itemSummary, setItemSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!amount) return;
    setSaving(true);
    try {
      await addSchoolQuote(schoolId, {
        amount: Number(amount),
        itemSummary,
        status: "draft",
      });
      setAmount("");
      setItemSummary("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-surface-border bg-surface-muted p-3 sm:grid-cols-[160px_1fr_auto]">
        <Input type="number" placeholder="견적금액" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="견적 항목 요약 (예: 출입통제 3식 + 설치)" value={itemSummary} onChange={(e) => setItemSummary(e.target.value)} />
        <Button size="sm" onClick={handleAdd} disabled={saving}>
          견적 추가
        </Button>
      </div>

      <div className="space-y-2">
        {loading && <p className="text-xs text-ink-300">불러오는 중...</p>}
        {!loading && quotes.length === 0 && (
          <p className="rounded-lg border border-dashed border-surface-border py-8 text-center text-xs text-ink-300">
            등록된 견적이 없습니다.
          </p>
        )}
        {quotes.map((q) => (
          <div key={q.id} className="flex items-center justify-between rounded-lg border border-surface-border bg-white p-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">{formatKRW(q.amount)}</p>
              <p className="text-xs text-ink-500">{q.itemSummary || "-"}</p>
              <p className="text-[11px] text-ink-300">{formatDate(q.createdAt)}</p>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLE[q.status])}>
              {STATUS_LABEL[q.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
