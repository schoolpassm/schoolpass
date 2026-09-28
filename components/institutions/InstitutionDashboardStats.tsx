"use client";

import { useMemo } from "react";
import { Timestamp } from "firebase/firestore";
import { Building2, PhoneCall, TrendingUp, Presentation, FlaskConical, Wallet, FileCheck2, PauseCircle, CalendarClock, AlertTriangle, Banknote } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { InstitutionDoc, PUBLIC_PIPELINE_STAGES } from "@/types";
import { getPublicStage } from "@/lib/public-pipeline";
import { formatKRW } from "@/lib/commission";

function toDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
}

/** 이번 주(월요일 00:00 ~ 다음주 월요일 00:00) 범위 */
function getThisWeekRange(): [Date, Date] {
  const now = new Date();
  const day = now.getDay(); // 0=일 ... 6=토
  const diffToMonday = (day + 6) % 7; // 월요일까지 며칠 전인지
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return [monday, nextMonday];
}

/**
 * 관공서/교육행정기관 대시보드 지표 (스펙 13번).
 * 기관별 진행단계·후속조치 지연 등은 모두 클라이언트에서 이미 불러온 institutions 배열을
 * 집계한다 — 226~400여 곳 규모라 별도 집계 쿼리 없이도 충분히 가볍다.
 */
export function InstitutionDashboardStats({ institutions }: { institutions: InstitutionDoc[] }) {
  const stats = useMemo(() => {
    const [weekStart, weekEnd] = getThisWeekRange();
    const today = new Date();

    let contacted = 0;
    let inProgress = 0;
    let demo = 0;
    let pilotReview = 0;
    let budgetReview = 0;
    let contracted = 0;
    let onHold = 0;
    let newContactsThisWeek = 0;
    let followUpsThisWeek = 0;
    let overdueFollowUps = 0;
    let expectedContractTotal = 0;
    const stageCounts: Record<string, number> = {};
    for (const s of PUBLIC_PIPELINE_STAGES) stageCounts[s] = 0;

    for (const inst of institutions) {
      const stage = getPublicStage(inst);
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;

      if (inst.firstContactedAt) contacted++;
      if (stage !== "계약완료" && stage !== "보류") inProgress++;
      if (stage === "제품시연") demo++;
      if (stage === "시범사업검토") pilotReview++;
      if (stage === "예산검토") budgetReview++;
      if (stage === "계약완료") contracted++;
      if (stage === "보류") onHold++;

      const firstContacted = toDate(inst.firstContactedAt);
      if (firstContacted && firstContacted >= weekStart && firstContacted < weekEnd) newContactsThisWeek++;

      const nextDue = toDate(inst.nextContactDueAt);
      if (nextDue) {
        if (nextDue >= weekStart && nextDue < weekEnd) followUpsThisWeek++;
        if (nextDue < today && stage !== "계약완료" && stage !== "보류" && stage !== "종료") overdueFollowUps++;
      }

      if (typeof inst.expectedContractAmount === "number") expectedContractTotal += inst.expectedContractAmount;
    }

    return {
      total: institutions.length,
      contacted,
      inProgress,
      demo,
      pilotReview,
      budgetReview,
      contracted,
      onHold,
      newContactsThisWeek,
      followUpsThisWeek,
      overdueFollowUps,
      expectedContractTotal,
      stageCounts,
    };
  }, [institutions]);

  const maxStageCount = Math.max(1, ...Object.values(stats.stageCounts));

  return (
    <div className="mb-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard icon={Building2} label="전체 기관" value={stats.total} accent="primary" />
        <StatCard icon={PhoneCall} label="접촉 기관" value={stats.contacted} accent="violet" />
        <StatCard icon={TrendingUp} label="진행 중" value={stats.inProgress} accent="primary" />
        <StatCard icon={Presentation} label="제품시연" value={stats.demo} accent="amber" />
        <StatCard icon={FlaskConical} label="시범사업검토" value={stats.pilotReview} accent="amber" />
        <StatCard icon={Wallet} label="예산검토" value={stats.budgetReview} accent="amber" />
        <StatCard icon={FileCheck2} label="계약완료" value={stats.contracted} accent="green" />
        <StatCard icon={PauseCircle} label="보류" value={stats.onHold} accent="violet" />
        <StatCard icon={CalendarClock} label="금주 신규접촉" value={stats.newContactsThisWeek} accent="primary" />
        <StatCard icon={CalendarClock} label="금주 후속조치 예정" value={stats.followUpsThisWeek} accent="primary" />
        <StatCard icon={AlertTriangle} label="후속조치 지연" value={stats.overdueFollowUps} accent="amber" />
        <StatCard icon={Banknote} label="예상 계약금액 합계" value={formatKRW(stats.expectedContractTotal)} accent="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기관별 진행단계</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1.5">
          {PUBLIC_PIPELINE_STAGES.map((stage) => {
            const count = stats.stageCounts[stage] ?? 0;
            return (
              <div key={stage} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-ink-500">{stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary-400"
                    style={{ width: `${(count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-medium text-ink-700">{count}</span>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
