"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { orderBy } from "firebase/firestore";
import { Plus, MapPin, CheckCircle2, Circle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { ScheduleDoc, ScheduleType } from "@/types";
import { ScheduleFormModal } from "@/components/schedule/ScheduleFormModal";
import { toggleScheduleDone } from "@/lib/api/schedules";
import { formatDate, cn } from "@/lib/utils";

const TYPE_LABEL: Record<ScheduleType, string> = {
  visit: "방문예약",
  demo: "시연예약",
  meeting: "미팅",
  call: "전화",
  etc: "기타",
};

export default function SchedulePage() {
  const { data: schedules, loading } = useCollection<ScheduleDoc>("schedules", [orderBy("startAt", "asc")]);
  const [formOpen, setFormOpen] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<string, ScheduleDoc[]> = {};
    for (const s of schedules) {
      const key = formatDate(s.startAt);
      map[key] = map[key] ?? [];
      map[key].push(s);
    }
    return map;
  }, [schedules]);

  return (
    <AppShell title="일정관리">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500">방문·시연 예약과 알림을 관리합니다 {loading && "· 불러오는 중..."}</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 일정 등록
        </Button>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="mb-2 text-xs font-semibold text-ink-500">{date}</p>
            <div className="space-y-2">
              {items.map((s) => (
                <Card key={s.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleScheduleDone(s.id, !s.done)} className="text-ink-300 hover:text-primary-500">
                      {s.done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
                    </button>
                    <div>
                      <p className={cn("text-sm font-medium", s.done ? "text-ink-300 line-through" : "text-ink-900")}>
                        {s.title}
                      </p>
                      <p className="text-xs text-ink-500">
                        {TYPE_LABEL[s.type]} · {s.schoolName ?? "-"} · {formatDate(s.startAt, true).split(" ")[1]}
                      </p>
                    </div>
                  </div>
                  {s.location && (
                    <span className="flex items-center gap-1 text-xs text-ink-300">
                      <MapPin size={12} /> {s.location}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
        {schedules.length === 0 && !loading && (
          <p className="rounded-lg border border-dashed border-surface-border py-16 text-center text-sm text-ink-300">
            등록된 일정이 없습니다.
          </p>
        )}
      </div>

      <ScheduleFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
