"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { orderBy } from "firebase/firestore";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { ContractDoc } from "@/types";
import { ContractTable } from "@/components/contracts/ContractTable";
import { ContractFormModal } from "@/components/contracts/ContractFormModal";
import { formatKRW } from "@/lib/commission";

export default function ContractsPage() {
  const { data: contracts, loading } = useCollection<ContractDoc>("contracts", [orderBy("createdAt", "desc")]);
  const [formOpen, setFormOpen] = useState(false);

  const totals = useMemo(() => {
    return contracts.reduce(
      (acc, c) => {
        acc.amount += c.contractAmount ?? 0;
        acc.commission += c.commission?.baseCommission ?? 0;
        return acc;
      },
      { amount: 0, commission: 0 }
    );
  }, [contracts]);

  return (
    <AppShell title="계약관리">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink-500">총 계약 건수</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{contracts.length}건</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">누적 계약금액</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatKRW(totals.amount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">누적 기본수수료</p>
          <p className="mt-1 text-xl font-bold text-primary-600">{formatKRW(totals.commission)}</p>
        </Card>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">{loading && "불러오는 중..."}</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 계약 등록
        </Button>
      </div>

      <ContractTable contracts={contracts} />

      <ContractFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
