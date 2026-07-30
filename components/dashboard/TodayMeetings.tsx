"use client";

import Link from "next/link";
import { Timestamp, where, orderBy } from "firebase/firestore";
import { CalendarClock, MapPin } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { ScheduleDoc, ScheduleType } from "@/types";

const TYPE_LABEL: Record<ScheduleType, string> = {
  visit: "방문",
  demo: "시연",
  meeting: "미팅",
  call: "전화",
  etc: "기타",
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

export function TodayMeetings() {
  const { start, end } = todayRange();
  const { data: schedules, loading } = useCollection<ScheduleDoc>("schedules", [
    where("startAt", ">=", start),
    where("startAt", "<=", end),
    orderBy("startAt", "asc"),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘 미팅</CardTitle>
        <Link href="/schedule" className="text-xs font-medium text-primary-600 hover:underline">
          일정관리 전체보기 →
        </Link>
      </CardHeader>
      <CardBody className="p-0">
        {loading && <p className="px-5 py-6 text-center text-xs text-ink-300">불러오는 중...</p>}
        {!loading && schedules.length === 0 && (
          <p className="px-5 py-8 text-center text-xs text-ink-300">오늘 예정된 미팅/방문/시연이 없습니다.</p>
        )}
        {schedules.length > 0 && (
          <ul className="divide-y divide-surface-border">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <CalendarClock size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {s.title} <span className="text-xs text-ink-500">({TYPE_LABEL[s.type]})</span>
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {s.startAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    {s.schoolName && ` · ${s.schoolName}`}
                    {s.assigneeName && ` · ${s.assigneeName}`}
                  </p>
                </div>
                {s.location && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-300">
                    <MapPin size={12} /> {s.location}
                  </span>
                )}
                {s.schoolId && (
                  <Link href={`/schools/${s.schoolId}`} className="shrink-0 text-xs font-medium text-primary-600 hover:underline">
                    학교 보기
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
