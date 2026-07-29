"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { SCHOOLINFO_LEVEL_CODES } from "@/lib/schoolinfo";
import { SIGUNGU_CODES } from "@/lib/schoolinfo-regions";

const SIDO_OPTIONS = Array.from(
  new Map(SIGUNGU_CODES.filter((s) => s.sidoCode !== "00").map((s) => [s.sidoCode, s.sidoName])).entries()
);

export function StudentCountSyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [levels, setLevels] = useState<Set<string>>(new Set(SCHOOLINFO_LEVEL_CODES.map((l) => l.code)));
  const [sidoCode, setSidoCode] = useState(SIDO_OPTIONS[0]?.[0] ?? "");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    matchedByName: number;
    unmatched: number;
    usedWildcard: boolean;
    requiresSido: boolean;
    debug?: {
      districtsAttempted: number;
      districtsSucceeded: number;
      totalRowsFetched: number;
      wildcardSampleError: string | null;
      districtSampleError: string | null;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleLevel(code: string) {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSync() {
    if (!firebaseUser) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/schools/sync-student-count", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year, levelCodes: Array.from(levels), sidoCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "동기화 실패");
      setResult({
        matched: json.matched,
        matchedByName: json.matchedByName,
        unmatched: json.unmatched,
        usedWildcard: json.usedWildcard,
        requiresSido: json.requiresSido,
        debug: json.debug,
      });
    } catch (e: any) {
      setError(e.message || "동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학생수 · 학급수 동기화">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          학교알리미(schoolinfo.go.kr)의 학년별·학급별 학생수 공시자료를 가져와 이미 등록된 학교의
          학생수·학급수를 채웁니다. (나이스로 먼저 등록된 학교와 표준학교코드로 매칭 — 매칭 안 되는 학교는 건너뜁니다)
        </p>
        <Field label="공시연도 (최근 3년만 제공)">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>
        <Field label="시/도 (전국 일괄 조회가 안 될 경우 이 지역 단위로 조회)">
          <Select value={sidoCode} onChange={(e) => setSidoCode(e.target.value)}>
            {SIDO_OPTIONS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-500">대상 학교급</p>
          <div className="flex flex-wrap gap-2">
            {SCHOOLINFO_LEVEL_CODES.map((l) => (
              <label key={l.code} className="flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-xs">
                <input type="checkbox" checked={levels.has(l.code)} onChange={() => toggleLevel(l.code)} className="accent-primary-500" />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        {result && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            동기화 완료 — 매칭 {result.matched}건 반영 (그 중 이름매칭 {result.matchedByName}건), 미매칭 {result.unmatched}건
            {result.usedWildcard && " (전국 일괄 조회 성공)"}
            {!result.usedWildcard && !result.requiresSido && " (선택하신 시/도 단위로 조회함)"}
          </div>
        )}
        {result?.debug && (
          <div className="rounded-lg bg-surface-muted p-3 text-[11px] text-ink-500">
            진단정보: 시군구 {result.debug.districtsAttempted}곳 시도 중 {result.debug.districtsSucceeded}곳 성공,
            받아온 원본 데이터 {result.debug.totalRowsFetched}건
            {result.debug.wildcardSampleError && (
              <p className="mt-1 text-status-danger">전국일괄 에러: {result.debug.wildcardSampleError}</p>
            )}
            {result.debug.districtSampleError && (
              <p className="mt-1 text-status-danger">시군구별 에러: {result.debug.districtSampleError}</p>
            )}
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleSync} disabled={syncing || levels.size === 0}>
            <Users size={14} /> {syncing ? "동기화 중... (시도 전체라 몇 분 걸릴 수 있음)" : "동기화 실행"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
