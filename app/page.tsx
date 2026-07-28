"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import {
  School,
  Building2,
  PhoneCall,
  CalendarClock,
  MonitorPlay,
  FileText,
  FileSignature,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { RegionContractChart, MonthlyContractChart } from "@/components/dashboard/Charts";
import { PipelineOverview } from "@/components/dashboard/PipelineOverview";
import { useCollection } from "@/lib/hooks/useCollection";
import { SchoolDoc, EducationOfficeDoc, ContractDoc } from "@/types";

export default function DashboardPage() {
  const { data: schools, loading: schoolsLoading } = useCollection<SchoolDoc>("schools");
  const { data: eduOffices } = useCollection<EducationOfficeDoc>("educationOffices");
  const { data: contracts } = useCollection<ContractDoc>("contracts");

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of schools) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [schools]);

  const regionData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contracts) map[c.region] = (map[c.region] ?? 0) + 1;
    return Object.entries(map).map(([region, count]) => ({ region, count }));
  }, [contracts]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contracts) {
      if (!c.contractDate) continue;
      const d = c.contractDate.toDate();
      const key = `${d.getMonth() + 1}월`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).map(([month, count]) => ({ month, count }));
  }, [contracts]);

  return (
    <AppShell title="대시보드">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <StatCard icon={School} label="학교DB 수" value={schoolsLoading ? "-" : schools.length} accent="primary" />
        <StatCard icon={Building2} label="교육지원청 수" value={eduOffices.length} accent="violet" />
        <StatCard icon={PhoneCall} label="전화 완료" value={stageCounts["전화완료"] ?? 0} accent="primary" />
        <StatCard icon={CalendarClock} label="방문 예정" value={stageCounts["방문예정"] ?? 0} accent="amber" />
        <StatCard icon={MonitorPlay} label="시연 예정" value={stageCounts["시연"] ?? 0} accent="violet" />
        <StatCard icon={FileText} label="견적" value={stageCounts["견적"] ?? 0} accent="amber" />
        <StatCard icon={FileSignature} label="계약" value={stageCounts["계약"] ?? 0} accent="green" />
        <StatCard icon={CheckCircle2} label="설치 완료" value={stageCounts["설치완료"] ?? 0} accent="green" />
      </div>

      <div className="mt-4">
        <PipelineOverview counts={stageCounts} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RegionContractChart data={regionData} />
        <MonthlyContractChart data={monthlyData} />
      </div>
    </AppShell>
  );
}
