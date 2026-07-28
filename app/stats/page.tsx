"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { ContractDoc, PartnerDoc } from "@/types";
import { formatKRW } from "@/lib/commission";

export default function StatsPage() {
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const { data: partners } = useCollection<PartnerDoc>("partners");

  const totalRevenue = contracts.reduce((sum, c) => sum + (c.contractAmount ?? 0), 0);
  const totalCommission = contracts.reduce((sum, c) => sum + (c.commission?.baseCommission ?? 0), 0);

  const byRegion = useMemo(() => {
    const map: Record<string, number> = {};
    contracts.forEach((c) => (map[c.region] = (map[c.region] ?? 0) + c.contractAmount));
    return Object.entries(map).map(([region, amount]) => ({ region, amount }));
  }, [contracts]);

  const bySchool = useMemo(() => {
    const map: Record<string, number> = {};
    contracts.forEach((c) => (map[c.schoolName] = (map[c.schoolName] ?? 0) + c.contractAmount));
    return Object.entries(map)
      .map(([school, amount]) => ({ school, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [contracts]);

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    contracts.forEach((c) => {
      if (!c.contractDate) return;
      const d = c.contractDate.toDate();
      const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] ?? 0) + c.contractAmount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));
  }, [contracts]);

  const byPartner = useMemo(
    () => partners.map((p) => ({ partner: p.name, revenue: p.totalRevenue ?? 0, commission: p.totalCommission ?? 0 })),
    [partners]
  );

  return (
    <AppShell title="통계">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-ink-500">누적 매출</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatKRW(totalRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-500">누적 수수료 (기본 35%)</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{formatKRW(totalCommission)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="지역별 계약금액" data={byRegion} xKey="region" yKey="amount" />
        <ChartCard title="학교별 계약금액 (상위 10)" data={bySchool} xKey="school" yKey="amount" />
        <ChartCard title="월별 계약금액" data={byMonth} xKey="month" yKey="amount" />
        <ChartCard title="파트너별 매출 실적" data={byPartner} xKey="partner" yKey="revenue" />
      </div>
    </AppShell>
  );
}

function ChartCard({ title, data, xKey, yKey }: { title: string; data: any[]; xKey: string; yKey: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
            <Tooltip formatter={(v: number) => new Intl.NumberFormat("ko-KR").format(v) + "원"} cursor={{ fill: "#F5F7FB" }} />
            <Bar dataKey={yKey} fill="#3B63E0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
