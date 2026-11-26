"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { limit, orderBy, where, Timestamp } from "firebase/firestore";
import { Phone, ChevronDown, ChevronUp, CalendarCheck, AlertCircle, Building2, School } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { GradeBadge, StatusBadge } from "@/components/ui/Badge";
import { QuickCallLog } from "@/components/schools/QuickCallLog";
import { useCollection } from "@/lib/hooks/useCollection";
import { InstitutionDoc, SchoolSummaryDoc } from "@/types";
import { cn, toTel } from "@/lib/utils";

const DONE_STATUSES = ["설치완료", "보류", "실패"];

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysLate(ts: Timestamp | null | undefined): number {
  if (!ts) return 0;
  const startToday = new Date().setHours(0, 0, 0, 0);
  const due = new Date(ts.toDate()).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((startToday - due) / 86400000));
}

function DueBadge({ ts }: { ts: Timestamp | null | undefined }) {
  const late = daysLate(ts);
  return late > 0 ? (
    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-status-danger">{late}일 지남</span>
  ) : (
    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">오늘</span>
  );
}

/**
 * 오늘 할 일 — 다음 연락 예정일이 오늘이거나 지난 학교/기관을 가장 위에 모아 보여준다.
 * 전화는 탭 한 번(tel:), 통화가 끝나면 "기록"을 펼쳐 3초 기록으로 다음 연락일까지 바로 잡는다.
 * 기록하면 다음 연락일이 미래로 밀려서 이 목록에서 자동으로 사라진다(실시간 구독).
 */
export function TodayTasks({ fallbackSchools }: { fallbackSchools: SchoolSummaryDoc[] }) {
  const end = useMemo(() => Timestamp.fromDate(endOfToday()), []);
  const { data: schoolsRaw, loading: schoolsLoading, error: schoolsError } = useCollection<SchoolSummaryDoc>("schools_summary", [
    where("nextContactAt", "<=", end),
    orderBy("nextContactAt", "asc"),
    limit(40),
  ]);
  const { data: instsRaw, loading: instsLoading } = useCollection<InstitutionDoc>("institutions", [
    where("nextContactDueAt", "<=", end),
    orderBy("nextContactDueAt", "asc"),
    limit(20),
  ]);
  const [openId, setOpenId] = useState<string | null>(null);

  const schools = useMemo(() => schoolsRaw.filter((s) => !DONE_STATUSES.includes(s.status)), [schoolsRaw]);
  const insts = useMemo(
    () => instsRaw.filter((i) => !["설치완료", "보류", "실패"].includes(i.status) && !["보류", "실패", "운영중"].includes(i.salesStage ?? "")),
    [instsRaw]
  );

  const overdueCount =
    schools.filter((s) => daysLate(s.nextContactAt) > 0).length + insts.filter((i) => daysLate(i.nextContactDueAt) > 0).length;
  const total = schools.length + insts.length;
  const loading = schoolsLoading || instsLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <CalendarCheck size={16} className="text-primary-500" /> 오늘 할 일
          </span>
        </CardTitle>
        <span className="text-xs text-ink-500">
          {loading ? "불러오는 중..." : `총 ${total}곳`}
          {overdueCount > 0 && <span className="ml-1.5 font-semibold text-status-danger">· 지연 {overdueCount}</span>}
        </span>
      </CardHeader>
      <CardBody className="p-0">
        {schoolsError && (
          <p className="flex items-start gap-1.5 border-b border-surface-border bg-amber-50 px-5 py-3 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            일정을 불러오지 못했습니다. 일시적인 조회 제한(무료 요금제 일일 한도)일 수 있으니 잠시 뒤 새로고침해 주세요.
          </p>
        )}

        {!loading && total === 0 && (
          <div className="px-5 py-6">
            <p className="text-sm font-medium text-ink-900">오늘 잡힌 연락 일정이 없습니다 👍</p>
            <p className="mt-1 text-xs text-ink-500">
              통화 후 "3초 기록"을 남기면 다음 연락일이 자동으로 잡혀 여기에 나타납니다. 일정이 없을 땐 아래 신규 학교부터 전화해 보세요.
            </p>
            {fallbackSchools.length > 0 && (
              <ul className="mt-3 divide-y divide-surface-border rounded-lg border border-surface-border">
                {fallbackSchools.slice(0, 5).map((s) => (
                  <SchoolRow key={s.id} s={s} due={null} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
                ))}
              </ul>
            )}
          </div>
        )}

        {total > 0 && (
          <ul className="divide-y divide-surface-border">
            {schools.map((s) => (
              <SchoolRow key={s.id} s={s} due={s.nextContactAt} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
            ))}
            {insts.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Building2 size={16} className="shrink-0 text-violet-500" />
                <Link href={`/institutions/${i.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{i.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {i.type} · {i.region}
                    {i.nextAction ? ` · ${i.nextAction}` : ""}
                  </p>
                </Link>
                <DueBadge ts={i.nextContactDueAt} />
                <a
                  href={toTel(i.contactPhone || i.phone)}
                  aria-label="전화걸기"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white hover:bg-primary-600"
                >
                  <Phone size={16} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SchoolRow({
  s,
  due,
  open,
  onToggle,
}: {
  s: SchoolSummaryDoc;
  due: Timestamp | null | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const phone = s.contactPhone || s.phone;
  const priority = (s.tags ?? []).includes("우선클로징");
  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <School size={16} className="shrink-0 text-primary-400" />
        <Link href={`/schools/${s.id}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-900">
            {priority && <span className="text-amber-500">★</span>}
            <span className="truncate">{s.name}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs text-ink-500">
            <GradeBadge grade={s.grade} />
            <StatusBadge status={s.status} />
            <span className="truncate">
              {s.region}
              {s.contactName ? ` · ${s.contactName}` : ""}
            </span>
          </p>
        </Link>
        {due !== null && <DueBadge ts={due} />}
        <button
          type="button"
          onClick={onToggle}
          aria-label="통화 기록 열기"
          className="flex h-10 shrink-0 items-center gap-0.5 rounded-lg border border-surface-border px-2 text-xs font-medium text-ink-500 hover:bg-surface-muted"
        >
          기록 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <a
          href={toTel(phone)}
          aria-label="전화걸기"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
            phone ? "bg-primary-500 hover:bg-primary-600" : "pointer-events-none bg-ink-300"
          )}
        >
          <Phone size={16} />
        </a>
      </div>
      {open && (
        <div className="bg-surface-muted px-4 pb-3 sm:px-5">
          <QuickCallLog schoolId={s.id} currentStatus={s.status} compact onSaved={onToggle} />
        </div>
      )}
    </li>
  );
}
