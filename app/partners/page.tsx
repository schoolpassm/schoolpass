"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { PartnerDoc } from "@/types";
import { formatKRW } from "@/lib/commission";
import { PartnerFormModal } from "@/components/partners/PartnerFormModal";
import { toTel, toMailto } from "@/lib/utils";

const ZONE_STYLE: Record<string, string> = {
  공동권역: "bg-primary-50 text-primary-600",
  신규권역: "bg-emerald-50 text-emerald-600",
  사촌권역: "bg-amber-50 text-amber-600",
};

export default function PartnersPage() {
  const { data: partners, loading } = useCollection<PartnerDoc>("partners");
  const [formOpen, setFormOpen] = useState(false);

  return (
    <AppShell title="파트너관리">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500">총 {partners.length}명 파트너 {loading && "· 불러오는 중..."}</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 파트너 등록
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {partners.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink-500">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-500">{p.region}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ZONE_STYLE[p.zone]}`}>{p.zone}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-surface-border pt-3 text-center">
              <div>
                <p className="text-[11px] text-ink-500">소개건수</p>
                <p className="text-sm font-bold text-ink-900">{p.referralCount ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500">계약건수</p>
                <p className="text-sm font-bold text-ink-900">{p.contractCount ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500">매출</p>
                <p className="text-sm font-bold text-ink-900">{formatKRW(p.totalRevenue ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500">수수료</p>
                <p className="text-sm font-bold text-primary-600">{formatKRW(p.totalCommission ?? 0)}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 border-t border-surface-border pt-3">
              <a href={toTel(p.phone)} className="flex-1">
                <button className="w-full rounded-md border border-surface-border py-1.5 text-xs text-ink-700 hover:bg-surface-muted">전화</button>
              </a>
              <a href={toMailto(p.email)} className="flex-1">
                <button className="w-full rounded-md border border-surface-border py-1.5 text-xs text-ink-700 hover:bg-surface-muted">이메일</button>
              </a>
            </div>
          </Card>
        ))}
        {partners.length === 0 && !loading && (
          <p className="col-span-full rounded-lg border border-dashed border-surface-border py-16 text-center text-sm text-ink-300">
            등록된 파트너가 없습니다.
          </p>
        )}
      </div>

      <PartnerFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
