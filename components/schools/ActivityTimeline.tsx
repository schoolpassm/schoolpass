"use client";

import { useState } from "react";
import { Phone, Mail, MessageSquare, MapPin, StickyNote, RefreshCw } from "lucide-react";
import { useCollection } from "@/lib/hooks/useCollection";
import { orderBy } from "firebase/firestore";
import { ActivityType, SchoolActivityDoc } from "@/types";
import { addSchoolActivity } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { formatDate, cn } from "@/lib/utils";

const TYPE_META: Record<ActivityType, { label: string; icon: any; color: string }> = {
  call: { label: "전화", icon: Phone, color: "text-primary-600 bg-primary-50" },
  email: { label: "이메일", icon: Mail, color: "text-violet-600 bg-violet-50" },
  sms: { label: "문자", icon: MessageSquare, color: "text-emerald-600 bg-emerald-50" },
  visit: { label: "방문", icon: MapPin, color: "text-amber-600 bg-amber-50" },
  memo: { label: "메모", icon: StickyNote, color: "text-gray-600 bg-gray-100" },
  status_change: { label: "상태변경", icon: RefreshCw, color: "text-sky-600 bg-sky-50" },
};

const FILTERS: { key: ActivityType | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "call", label: "전화기록" },
  { key: "email", label: "이메일기록" },
  { key: "sms", label: "문자기록" },
  { key: "visit", label: "방문기록" },
  { key: "memo", label: "메모" },
];

export function ActivityTimeline({ schoolId }: { schoolId: string }) {
  const { data: activities, loading } = useCollection<SchoolActivityDoc>(`schools/${schoolId}/activities`, [
    orderBy("createdAt", "desc"),
  ]);
  const { firebaseUser, userDoc } = useAuth();
  const [filter, setFilter] = useState<ActivityType | "all">("all");
  const [type, setType] = useState<ActivityType>("call");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = filter === "all" ? activities : activities.filter((a) => a.type === filter);

  async function handleAdd() {
    if (!summary.trim() || !firebaseUser) return;
    setSaving(true);
    try {
      await addSchoolActivity(schoolId, {
        type,
        summary: summary.trim(),
        authorUid: firebaseUser.uid,
        authorName: userDoc?.name ?? "",
      });
      setSummary("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              filter === f.key ? "bg-primary-500 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface-border"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 rounded-lg border border-surface-border bg-surface-muted p-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ActivityType)}
          className="h-9 rounded-lg border border-surface-border bg-white px-2 text-xs"
        >
          <option value="call">전화</option>
          <option value="email">이메일</option>
          <option value="sms">문자</option>
          <option value="visit">방문</option>
          <option value="memo">메모</option>
        </select>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="활동 내용을 기록하세요 (예: 행정실장 통화, 다음주 방문 약속)"
          className="h-9 flex-1 rounded-lg border border-surface-border bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={saving}>
          기록
        </Button>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-xs text-ink-300">불러오는 중...</p>}
        {!loading && filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-surface-border py-8 text-center text-xs text-ink-300">
            아직 기록이 없습니다.
          </p>
        )}
        {filtered.map((a) => {
          const meta = TYPE_META[a.type];
          const Icon = meta.icon;
          return (
            <div key={a.id} className="flex gap-3">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.color)}>
                <Icon size={14} />
              </div>
              <div className="flex-1 rounded-lg border border-surface-border bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-900">{meta.label}</span>
                  <span className="text-[11px] text-ink-300">{formatDate(a.createdAt, true)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-700">{a.summary}</p>
                <p className="mt-1 text-[11px] text-ink-300">{a.authorName}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
