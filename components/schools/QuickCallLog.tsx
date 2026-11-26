"use client";

import { useState } from "react";
import { PhoneCall, PhoneMissed, UserCog, FileText, Check } from "lucide-react";
import { addSchoolActivity } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { SchoolStatus } from "@/types";
import { cn } from "@/lib/utils";

/**
 * 통화 후 3초 기록 — 전화 끝나자마자 버튼 한 번으로
 *   ① 전화 활동기록 ② 다음 연락 예정일 ③(필요하면) 칸반 상태 이동
 * 을 한 배치로 저장한다. 다음 연락 간격은 결과별 기본값이 있고, 위 칩으로 미리 바꿀 수 있다.
 */
type Outcome = {
  key: string;
  label: string;
  summary: string; // 활동기록에 남는 문장
  result: string; // SchoolActivityDoc.result
  defaultDays: number;
  icon: any;
  tone: string;
  /** 현재 상태가 from 중 하나일 때만 to로 이동 (이미 더 앞선 단계면 건드리지 않음) */
  advance?: { from: SchoolStatus[]; to: SchoolStatus };
};

const OUTCOMES: Outcome[] = [
  {
    key: "connected",
    label: "연결됨",
    summary: "전화 연결됨",
    result: "연결됨",
    defaultDays: 7,
    icon: PhoneCall,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    advance: { from: ["신규"], to: "전화완료" },
  },
  {
    key: "missed",
    label: "부재중",
    summary: "전화 부재중(통화 못 함)",
    result: "부재중",
    defaultDays: 3,
    icon: PhoneMissed,
    tone: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
  {
    key: "owner_changed",
    label: "담당자 변경",
    summary: "담당자 변경/재확인 필요",
    result: "담당자 변경",
    defaultDays: 3,
    icon: UserCog,
    tone: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
  },
  {
    key: "material",
    label: "자료요청",
    summary: "자료 요청받음 (소개서/견적 발송 예정)",
    result: "자료 요청",
    defaultDays: 2,
    icon: FileText,
    tone: "border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100",
    advance: { from: ["신규", "전화완료"], to: "자료발송" },
  },
];

const DAY_CHIPS: { days: number | null; label: string }[] = [
  { days: null, label: "자동" },
  { days: 1, label: "+1일" },
  { days: 3, label: "+3일" },
  { days: 7, label: "+1주" },
  { days: 14, label: "+2주" },
];

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // 당일 오전 9시로 맞춰 "오늘 할 일"에 확실히 잡히게
  return d;
}

function fmt(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function QuickCallLog({
  schoolId,
  currentStatus,
  compact = false,
  onSaved,
}: {
  schoolId: string;
  currentStatus: SchoolStatus;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const { firebaseUser, userDoc } = useAuth();
  const [override, setOverride] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(o: Outcome) {
    if (!firebaseUser || busy) return;
    setBusy(o.key);
    setError(null);
    try {
      const days = override ?? o.defaultDays;
      const next = addDays(new Date(), days);
      const statusToApply = o.advance && o.advance.from.includes(currentStatus) ? o.advance.to : undefined;
      const text = memo.trim() ? `${o.summary} — ${memo.trim()}` : o.summary;
      await addSchoolActivity(
        schoolId,
        {
          type: "call",
          summary: text,
          result: o.result,
          nextActionAt: null,
          authorUid: firebaseUser.uid,
          authorName: userDoc?.name ?? "",
        },
        statusToApply,
        next
      );
      setDone(`${o.label} 저장됨 · 다음 연락 ${fmt(next)}${statusToApply ? ` · 상태 → ${statusToApply}` : ""}`);
      setMemo("");
      onSaved?.();
      setTimeout(() => setDone(null), 4000);
    } catch (e) {
      setError("저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("rounded-lg border border-surface-border bg-white", compact ? "p-2.5" : "p-3")}>
      {!compact && <p className="mb-2 text-xs font-semibold text-ink-900">통화 후 3초 기록</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OUTCOMES.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              type="button"
              disabled={!!busy}
              onClick={() => save(o)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50",
                o.tone
              )}
            >
              <Icon size={14} />
              {busy === o.key ? "저장 중..." : o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-ink-500">다음 연락:</span>
        {DAY_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setOverride(c.days)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              override === c.days ? "bg-primary-500 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface-border"
            )}
          >
            {c.label}
          </button>
        ))}
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="한 줄 메모 (선택)"
          className="ml-auto h-8 min-w-[140px] flex-1 rounded-lg border border-surface-border bg-white px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </div>

      {done && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <Check size={12} /> {done}
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-status-danger">{error}</p>}
    </div>
  );
}
