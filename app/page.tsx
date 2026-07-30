"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  School,
  Building2,
  PhoneCall,
  CalendarClock,
  MonitorPlay,
  FileText,
  FileSignature,
  CheckCircle2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { RegionContractChart, MonthlyContractChart } from "@/components/dashboard/Charts";
import { PipelineOverview } from "@/components/dashboard/PipelineOverview";
import { TopSchoolsList } from "@/components/dashboard/TopSchoolsList";
import { TodayMeetings } from "@/components/dashboard/TodayMeetings";
import { AiBriefingCard } from "@/components/dashboard/AiBriefingCard";
import { BudgetRecommendations } from "@/components/dashboard/BudgetRecommendations";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { EducationOfficeDoc, ContractDoc, PartnerDoc } from "@/types";
import { formatKRW } from "@/lib/commission";
import { db } from "@/lib/firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const stats = useDashboardStats();
  const { data: eduOffices } = useCollection<EducationOfficeDoc>("educationOffices");
  const { data: contracts } = useCollection<ContractDoc>("contracts");
  const { data: partners } = useCollection<PartnerDoc>("partners");

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

  // 예상 계약 / 예상 매출: 활성 파이프라인 중 AI 점수가 매겨진 학교들의 점수 합 × 평균 계약금액
  const avgContractAmount = useMemo(() => {
    if (contracts.length === 0) return 0;
    return contracts.reduce((sum, c) => sum + (c.contractAmount ?? 0), 0) / contracts.length;
  }, [contracts]);

  const expectedContracts = useMemo(() => {
    return stats.topContractProbability.reduce((sum, s) => sum + (s.aiScore ?? 0) / 100, 0);
  }, [stats.topContractProbability]);

  const expectedRevenue = expectedContracts * avgContractAmount;

  // 지역별 계약률 (계약 발생 지역에 한해 학교 수 대비 비율 계산 — bounded count 쿼리)
  const [regionRateData, setRegionRateData] = useState<{ region: string; rate: number }[]>([]);
  useEffect(() => {
    if (regionData.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        regionData.map(async (r) => {
          const snap = await getCountFromServer(query(collection(db, "schools_summary"), where("region", "==", r.region)));
          const total = snap.data().count;
          return { region: r.region, rate: total > 0 ? Math.round((r.count / total) * 1000) / 10 : 0 };
        })
      );
      if (!cancelled) setRegionRateData(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [regionData]);

  // 교육지원청 계약률: 계약된 학교의 eduOfficeName을 조회해 그룹핑 (계약 건수만큼만 조회, bounded)
  const [eduOfficeRateData, setEduOfficeRateData] = useState<{ eduOffice: string; rate: number; count: number }[]>([]);
  useEffect(() => {
    if (contracts.length === 0) return;
    let cancelled = false;
    (async () => {
      const { doc, getDoc } = await import("firebase/firestore");
      const uniqueSchoolIds = Array.from(new Set(contracts.map((c) => c.schoolId).filter(Boolean)));
      const schoolDocs = await Promise.all(uniqueSchoolIds.map((id) => getDoc(doc(db, "schools_summary", id))));
      const eduOfficeByContractSchool = new Map<string, string>();
      schoolDocs.forEach((snap, i) => {
        const eduOfficeName = snap.exists() ? (snap.data() as any).eduOfficeName : undefined;
        if (eduOfficeName) eduOfficeByContractSchool.set(uniqueSchoolIds[i], eduOfficeName);
      });

      const contractCountByOffice: Record<string, number> = {};
      for (const c of contracts) {
        const officeName = eduOfficeByContractSchool.get(c.schoolId);
        if (!officeName) continue;
        contractCountByOffice[officeName] = (contractCountByOffice[officeName] ?? 0) + 1;
      }

      const officeNames = Object.keys(contractCountByOffice);
      if (officeNames.length === 0) {
        if (!cancelled) setEduOfficeRateData([]);
        return;
      }

      const results = await Promise.all(
        officeNames.map(async (name) => {
          const snap = await getCountFromServer(query(collection(db, "schools_summary"), where("eduOfficeName", "==", name)));
          const total = snap.data().count;
          const count = contractCountByOffice[name];
          return { eduOffice: name, count, rate: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
        })
      );
      if (!cancelled) setEduOfficeRateData(results.sort((a, b) => b.rate - a.rate));
    })();
    return () => {
      cancelled = true;
    };
  }, [contracts]);

  const stageCounts = stats.stageCounts;

  return (
    <AppShell title="대시보드">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        <StatCard icon={School} label="학교DB 수" value={stats.loading ? "-" : stats.totalSchools} accent="primary" href="/schools" />
        <StatCard icon={Building2} label="교육지원청 수" value={eduOffices.length} accent="violet" href="/education-offices" />
        <StatCard icon={PhoneCall} label="전화 완료" value={stageCounts["전화완료"] ?? 0} accent="primary" href="/schools?status=전화완료" />
        <StatCard icon={CalendarClock} label="방문 예정" value={stageCounts["방문예정"] ?? 0} accent="amber" href="/schools?status=방문예정" />
        <StatCard icon={MonitorPlay} label="시연 예정" value={stageCounts["시연"] ?? 0} accent="violet" href="/schools?status=시연" />
        <StatCard icon={FileText} label="견적" value={stageCounts["견적"] ?? 0} accent="amber" href="/schools?status=견적" />
        <StatCard icon={FileSignature} label="계약" value={stageCounts["계약"] ?? 0} accent="green" href="/schools?status=계약" />
        <StatCard icon={CheckCircle2} label="설치 완료" value={stageCounts["설치완료"] ?? 0} accent="green" href="/schools?status=설치완료" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard
          icon={TrendingUp}
          label="예상 계약 건수 (AI 점수 기반)"
          value={expectedContracts.toFixed(1)}
          suffix="건"
          accent="primary"
        />
        <StatCard icon={Wallet} label="예상 매출 (추정)" value={formatKRW(Math.round(expectedRevenue))} accent="green" />
      </div>

      <div className="mt-4">
        <AiBriefingCard />
      </div>

      <div className="mt-4">
        <PipelineOverview counts={stageCounts} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopSchoolsList
          title="오늘 방문 추천 TOP10"
          schools={stats.topVisitTargets}
          emptyHint="AI 계약가능성 점수를 매긴 학교가 아직 없습니다."
          showActions
        />
        <TopSchoolsList
          title="계약 가능성 TOP20"
          schools={stats.topContractProbability}
          emptyHint="AI 계약가능성 점수를 매긴 학교가 아직 없습니다."
          showActions
        />
        <TopSchoolsList
          title="이번주 전화 대상"
          schools={stats.weeklyCallTargets}
          emptyHint="신규 상태 학교가 없습니다."
          showScore={false}
          showActions
        />
      </div>

      <div className="mt-4">
        <TodayMeetings />
      </div>

      <div className="mt-4">
        <BudgetRecommendations />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RegionContractChart data={regionData} />
        <MonthlyContractChart data={monthlyData} />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>지역별 계약률 (계약 건수 / 해당 지역 학교 수)</CardTitle>
          </CardHeader>
          <CardBody className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} cursor={{ fill: "#F5F7FB" }} />
                <Bar dataKey="rate" fill="#2FBF71" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>교육지원청 계약률 (계약 건수 / 해당 교육지원청 학교 수)</CardTitle>
          </CardHeader>
          <CardBody className="h-72">
            {eduOfficeRateData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-xs text-ink-300">
                교육지원청명이 채워진 계약학교가 아직 없습니다 (학교관리 → 공공데이터 동기화로 채울 수 있어요).
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eduOfficeRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
                  <XAxis dataKey="eduOffice" tick={{ fontSize: 10, fill: "#667085" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} cursor={{ fill: "#F5F7FB" }} />
                  <Bar dataKey="rate" fill="#7A5CF0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>파트너 실적</CardTitle>
            <Link href="/partners" className="text-xs font-medium text-primary-600 hover:underline">
              전체 보기 →
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {partners.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-ink-300">등록된 파트너가 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-muted text-left text-xs text-ink-500">
                    <th className="px-5 py-2.5 font-medium">파트너</th>
                    <th className="px-5 py-2.5 font-medium">계약건수</th>
                    <th className="px-5 py-2.5 font-medium">매출</th>
                    <th className="px-5 py-2.5 font-medium">수수료</th>
                  </tr>
                </thead>
                <tbody>
                  {[...partners]
                    .sort((a, b) => (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0))
                    .slice(0, 5)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-surface-border last:border-0">
                        <td className="px-5 py-2.5 font-medium text-ink-900">{p.name}</td>
                        <td className="px-5 py-2.5 text-ink-500">{p.contractCount ?? 0}건</td>
                        <td className="px-5 py-2.5 text-ink-500">{formatKRW(p.totalRevenue ?? 0)}</td>
                        <td className="px-5 py-2.5 font-semibold text-primary-600">{formatKRW(p.totalCommission ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
