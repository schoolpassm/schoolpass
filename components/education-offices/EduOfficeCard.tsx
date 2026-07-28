"use client";

import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { Phone, Mail, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCollection } from "@/lib/hooks/useCollection";
import { EducationOfficeDoc, EduOfficeEventDoc, EduOfficeEventType } from "@/types";
import { addEduOfficeEvent } from "@/lib/api/educationOffices";
import { formatDate, toTel, toMailto } from "@/lib/utils";

const EVENT_LABEL: Record<EduOfficeEventType, string> = {
  visit: "방문기록",
  material_sent: "자료발송",
  meeting: "미팅일정",
};

export function EduOfficeCard({ office }: { office: EducationOfficeDoc }) {
  const [open, setOpen] = useState(false);
  const { data: events } = useCollection<EduOfficeEventDoc>(`educationOffices/${office.id}/events`, [
    orderBy("createdAt", "desc"),
  ]);
  const [type, setType] = useState<EduOfficeEventType>("visit");
  const [summary, setSummary] = useState("");

  async function handleAdd() {
    if (!summary.trim()) return;
    await addEduOfficeEvent(office.id, { type, summary: summary.trim(), scheduledAt: null, authorUid: "", authorName: "" });
    setSummary("");
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Building2 size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">{office.name}</p>
            <p className="text-xs text-ink-500">{office.region} · {office.department || "담당부서 미지정"}</p>
            <p className="text-xs text-ink-500">담당자 {office.contactName || "-"}</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-md p-1.5 text-ink-500 hover:bg-surface-muted">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <a href={toTel(office.phone)}>
          <button className="flex items-center gap-1 rounded-md border border-surface-border px-2.5 py-1.5 text-xs text-ink-700 hover:bg-surface-muted">
            <Phone size={12} /> 전화
          </button>
        </a>
        <a href={toMailto(office.email)}>
          <button className="flex items-center gap-1 rounded-md border border-surface-border px-2.5 py-1.5 text-xs text-ink-700 hover:bg-surface-muted">
            <Mail size={12} /> 이메일
          </button>
        </a>
      </div>

      {open && (
        <div className="mt-4 border-t border-surface-border pt-3">
          <div className="mb-3 flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EduOfficeEventType)}
              className="h-8 rounded-md border border-surface-border bg-white px-2 text-xs"
            >
              <option value="visit">방문기록</option>
              <option value="material_sent">자료발송</option>
              <option value="meeting">미팅일정</option>
            </select>
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="내용 입력"
              className="h-8 flex-1 rounded-md border border-surface-border px-2 text-xs"
            />
            <Button size="sm" onClick={handleAdd}>
              추가
            </Button>
          </div>
          <div className="space-y-2">
            {events.length === 0 && <p className="text-xs text-ink-300">기록이 없습니다.</p>}
            {events.map((ev) => (
              <div key={ev.id} className="rounded-md bg-surface-muted p-2 text-xs">
                <span className="font-medium text-primary-600">{EVENT_LABEL[ev.type]}</span>
                <span className="ml-2 text-ink-700">{ev.summary}</span>
                <span className="float-right text-ink-300">{formatDate(ev.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
