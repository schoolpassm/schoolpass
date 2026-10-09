"use client";

import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import {
  Target,
  PhoneCall,
  UserCheck,
  MonitorPlay,
  FileText,
  Wallet,
  ShieldCheck,
  FileSignature,
  CheckCircle2,
  Clock,
  TrendingUp,
  LucideIcon,
} from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { useCollection } from "@/lib/hooks/useCollection";
import { InstitutionDoc, InstitutionType, SalesProduct, SALES_PRODUCT_LABELS } from "@/types";
import { formatKRW } from "@/lib/commission";
import { DashboardStats } from "@/lib/hooks/useDashboardStats";

/**
 * ZeroPass 통합 확장(2026.10 지시서 4번) — 대시보드 상단 필터 + 신규 KPI.
 * 기존 대시보드 레이아웃/위젯은 전혀 건드리지 않고(지시서 4번 "기존 디자인 유지"),
 * institutions 데이터를 기반으로 한 새 패널을 그 위에 추가로 얹는다("공통 CRM 엔진" 원칙).
 *
 * 범위: 학교(SchoolPass)는 사실상 전부 SchoolPass 고객이라 예산/보안/조달 단계를 별도로
 * 추적하지 않는다(지시서 3번: "학교·민간기업은 일반 영업 흐름"). 그래서 예산확보/보안검토/
 * 조달검토 등 ZeroPass형 KPI는 institutions 컬렉션만 집계하고, 학교 쪽 수치는 기존
 * useDashboardStats()의 stageCounts/totalSchools을 그대로 재사용해 합산한다.
 */

type CustomerGroup = "전체" | "학교" | "교육기관" | "공공기관" | "공기업·공단" | "민간기업" | "군부대";

const CUSTOMER_GROUP_MAP: Record<InstitutionType, CustomerGroup> = {
  교육부: "교육기관",
  교육청: "교육기관",
  교육지원청: "교육기관",
  시청: "공공기관",
  군청: "공공기관",
  구청: "공공기관",
  소방서: "공공기관",
  경찰서: "공공기관",
  중앙행정기관: "공공기관",
  공공시설: "공공기관",
  "기타 공공기관": "공공기관",
  "공기업·공단": "공기업·공단",
  민간기업: "민간기업",
  제조공장: "민간기업",
  물류센터: "민간기업",
  연구소: "민간기업",
  "국방부·군기관": "군부대",
};

const PERIODS = ["전체", "오늘", "최근7일", "최근30일", "이번달"] as const;
type Period = (typeof PERIODS)[number];

function isWithinPeriod(ts: { toDate?: () => Date } | null | undefined, period: Period): boolean {
  if (period === "전체") return true;
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const now = new Date();
  if (period === "오늘") return d.toDateString() === now.toDateString();
  if (period === "최근7일") return now.getTime() - d.getTime() <= 7 * 86400000;
  if (period === "최근30일") return now.getTime() - d.getTime() <= 30 * 86400000;
  if (period === "이번달") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

// 단계별 확률(가중 예상매출용) — 관리자 설정값이 따로 없으므로, 보수적인 기본 추정치를 명시적으로 둔다.
// 실제 계약 데이터가 쌓이면 이 값을 실측 전환율로 교체해야 한다 (지시서 4·6번: "추정은 추정으로 표시").
const STAGE_PROBABILITY: Record<string, number> = {
  신규: 0.02,
  담당자확인: 0.05,
  전화완료: 0.08,
  자료발송: 0.12,
  방문예정: 0.18,
  시연예정: 0.25,
  시연완료: 0.35,
  견적: 0.45,
  내부검토협의: 0.5,
  예산검토: 0.55,
  보안검토: 0.6,
  조달검토: 0.65,
  계약: 1,
  설치구축: 1,
  운영중: 1,
  보류: 0.05,
  실패: 0,
};
const DEFAULT_DEAL_ESTIMATE = 15_000_000; // expectedContractAmount가 없는 경우 쓰는 추정 단가(원) — AI 추정치임을 항상 병기

export function UnifiedSalesPanel({ schoolStats }: { schoolStats: DashboardStats }) {
  const { data: institutions, loading } = useCollection<InstitutionDoc>("institutions", [orderBy("updatedAt", "desc")]);

  const [product, setProduct] = useState<"전체" | SalesProduct>("전체");
  const [group, setGroup] = useState<CustomerGroup>("전체");
  const [region, setRegion] = useState("전체");
  const [owner, setOwner] = useState("전체");
  const [period, setPeriod] = useState<Period>("전체");

  const regions = useMemo(() => Array.from(new Set(institutions.map((i) => i.region).filter(Boolean))).sort(), [institutions]);
  const owners = useMemo(
    () => Array.from(new Set(institutions.map((i) => i.ownerName).filter(Boolean))).sort() as string[],
    [institutions]
  );

  const includeSchools = group === "전체" || group === "학교";
  const includeInstitutions = group !== "학교" && (product === "전체" || product !== "school_pass");

  const filteredInstitutions = useMemo(() => {
    if (!includeInstitutions) return [];
    return institutions.filter((i) => {
      if (group !== "전체" && CUSTOMER_GROUP_MAP[i.type] !== group) return false;
      if (product !== "전체" && i.product && i.product !== "both" && i.product !== product) return false;
      if (region !== "전체" && i.region !== region) return false;
      if (owner !== "전체" && i.ownerName !== owner) return false;
      return true;
    });
  }, [institutions, group, product, region, owner, includeInstitutions]);

  // 학교 KPI는 필터(지역/담당자/제품)를 세분화하지 않고 기존 전체 집계를 그대로 쓴다 —
  // schools_summary(9,930+건)를 클라이언트에서 통째로 불러와 재집계하면 읽기 비용이 커지므로,
  // 기존 dashboard 집계 쿼리(count 집계, 지시서 8번 "읽기 비용 최소화" 원칙)를 재사용.
  const schoolTargetCount = includeSchools ? schoolStats.totalSchools : 0;
  const schoolDemoCount = includeSchools ? schoolStats.stageCounts["시연"] ?? 0 : 0;
  const schoolQuoteCount = includeSchools ? schoolStats.stageCounts["견적"] ?? 0 : 0;
  const schoolContractCount = includeSchools ? schoolStats.stageCounts["계약"] ?? 0 : 0;
  const schoolInstallCount = includeSchools ? schoolStats.stageCounts["설치완료"] ?? 0 : 0;
  const schoolCallDoneCount = includeSchools ? schoolStats.stageCounts["전화완료"] ?? 0 : 0;

  const kpis = useMemo(() => {
    const list = filteredInstitutions;
    const newContactsThisMonth = list.filter((i) => isWithinPeriod(i.firstContactedAt, "이번달")).length;
    const contactConnected = list.filter((i) => !!i.contactName).length;
    const demoCompleted = list.filter((i) => i.salesStage === "시연완료" || i.salesStage === "계약" || i.salesStage === "설치구축" || i.salesStage === "운영중").length;
    const quoteSent = list.filter((i) => ["견적", "내부검토협의", "예산검토", "보안검토", "조달검토", "계약", "설치구축", "운영중"].includes(i.salesStage ?? "")).length;
    const budgetSecured = list.filter((i) => i.budgetStatus === "예산확보" || i.budgetStatus === "구매진행").length;
    const securityInProgress = list.filter((i) => i.securityReviewStatus === "검토중").length;
    const contractCount = list.filter((i) => i.salesStage === "계약" || i.salesStage === "설치구축" || i.salesStage === "운영중" || i.status === "계약").length;
    const installCount = list.filter((i) => i.salesStage === "설치구축" || i.salesStage === "운영중" || i.status === "설치완료").length;

    const activeList = list.filter((i) => !["보류", "실패"].includes(i.salesStage ?? ""));
    const expectedRevenue = activeList.reduce((sum, i) => sum + (i.expectedContractAmount || DEFAULT_DEAL_ESTIMATE), 0);
    const weightedExpectedRevenue = activeList.reduce((sum, i) => {
      const prob = STAGE_PROBABILITY[i.salesStage ?? "신규"] ?? STAGE_PROBABILITY[i.status] ?? 0.05;
      return sum + (i.expectedContractAmount || DEFAULT_DEAL_ESTIMATE) * prob;
    }, 0);

    const now = Date.now();
    const followUpOverdue = list.filter((i) => {
      if (!i.nextContactDueAt?.toDate) return false;
      return i.nextContactDueAt.toDate().getTime() < now && !["계약", "설치구축", "운영중", "보류", "실패"].includes(i.salesStage ?? "");
    }).length;

    return {
      targetCount: list.length + schoolTargetCount,
      newContactsThisMonth,
      contactConnected,
      demoCompleted: demoCompleted + schoolDemoCount,
      quoteSent: quoteSent + schoolQuoteCount,
      budgetSecured,
      securityInProgress,
      contractCount: contractCount + schoolContractCount,
      installCount: installCount + schoolInstallCount,
      expectedRevenue,
      weightedExpectedRevenue,
      followUpOverdue,
      callDone: schoolCallDoneCount, // 학교 전화완료 수 (참고용 표시, 기존 KPI와 중복 방지 위해 보조로만 노출)
    };
  }, [filteredInstitutions, schoolTargetCount, schoolDemoCount, schoolQuoteCount, schoolContractCount, schoolInstallCount, schoolCallDoneCount]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>통합 영업 현황 (SchoolPass + ZeroPass)</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={product} onChange={(e) => setProduct(e.target.value as "전체" | SalesProduct)} className="w-36">
            <option value="전체">전체 제품</option>
            {(["school_pass", "zero_pass", "both"] as SalesProduct[]).map((p) => (
              <option key={p} value={p}>
                {SALES_PRODUCT_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select value={group} onChange={(e) => setGroup(e.target.value as CustomerGroup)} className="w-36">
            {(["전체", "학교", "교육기관", "공공기관", "공기업·공단", "민간기업", "군부대"] as CustomerGroup[]).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-32">
            <option value="전체">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} className="w-32">
            <option value="전체">전체 담당자</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-28">
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-xs text-ink-300">기관 데이터를 불러오는 중...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat icon={Target} label="제품별 영업 대상 수" value={kpis.targetCount} />
              <MiniStat icon={PhoneCall} label="이번 달 신규 접촉 수" value={kpis.newContactsThisMonth} />
              <MiniStat icon={UserCheck} label="담당자 연결 수" value={kpis.contactConnected} />
              <MiniStat icon={MonitorPlay} label="시연 완료 수" value={kpis.demoCompleted} />
              <MiniStat icon={FileText} label="견적 발송 수" value={kpis.quoteSent} />
              <MiniStat icon={Wallet} label="예산 확보 건수" value={kpis.budgetSecured} />
              <MiniStat icon={ShieldCheck} label="보안 검토 진행 건수" value={kpis.securityInProgress} />
              <MiniStat icon={FileSignature} label="계약 건수" value={kpis.contractCount} accent="green" />
              <MiniStat icon={CheckCircle2} label="설치 완료 건수" value={kpis.installCount} accent="green" />
              <MiniStat icon={Clock} label="후속 연락 지연 건수" value={kpis.followUpOverdue} accent="amber" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <TrendingUp size={12} /> AI 추정 · 예상 매출 (확정 아님)
                </p>
                <p className="mt-1 text-lg font-bold text-amber-800">{formatKRW(Math.round(kpis.expectedRevenue))}</p>
                <p className="text-[10px] text-amber-600">예상 계약금액 미입력 건은 임시 추정단가({formatKRW(DEFAULT_DEAL_ESTIMATE)})로 계산됨</p>
              </div>
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <TrendingUp size={12} /> AI 추정 · 단계별 확률 가중 예상 매출
                </p>
                <p className="mt-1 text-lg font-bold text-amber-800">{formatKRW(Math.round(kpis.weightedExpectedRevenue))}</p>
                <p className="text-[10px] text-amber-600">단계별 확률은 관리자 설정 데이터가 아직 없어 임시 기본값 사용 중 — 실측 전환율 축적 후 교체 필요</p>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: "primary" | "green" | "amber";
}) {
  const accentMap = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-500">{label}</p>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${accentMap[accent]}`}>
          <Icon size={12} />
        </div>
      </div>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
