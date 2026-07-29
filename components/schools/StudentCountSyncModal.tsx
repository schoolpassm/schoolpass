"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { SCHOOLINFO_LEVEL_CODES, SCHOOLINFO_CATEGORIES, SchoolinfoCategory } from "@/lib/schoolinfo";
import { SIGUNGU_CODES } from "@/lib/schoolinfo-regions";

const SIDO_OPTIONS = Array.from(
  new Map(SIGUNGU_CODES.filter((s) => s.sidoCode !== "00").map((s) => [s.sidoCode, s.sidoName])).entries()
);

export function StudentCountSyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [category, setCategory] = useState<SchoolinfoCategory>("student_count");
  const [year, setYear] = useState(new Date().getFullYear());
  const [levels, setLevels] = useState<Set<string>>(new Set(SCHOOLINFO_LEVEL_CODES.map((l) => l.code)));
  const [sidoCode, setSidoCode] = useState(SIDO_OPTIONS[0]?.[0] ?? "");
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ matched: number; matchedByName: number; unmatched: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<{
    districtsAttempted: number;
    districtsSucceeded: number;
    totalRowsFetched: number;
    districtSampleError: string | null;
  } | null>(null);

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
    setDebug(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/schools/sync-public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, year, levelCodes: Array.from(levels), sidoCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "동기화 실패");
      setResult({ matched: json.matched, matchedByName: json.matchedByName, unmatched: json.unmatched });
      setDebug(json.debug);
    } catch (e: any) {
      setError(e.message || "동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학교알리미 공공데이터 동기화" width="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          학교알리미(schoolinfo.go.kr) 공시자료를 카테고리별로 가져와 이미 등록된 학교에 반영합니다.
          (이름+지역으로 매칭 — 동명 학교가 여럿이면 안전하게 건너뜁니다)
        </p>

        <Field label="데이터 종류">
          <Select value={category} onChange={(e) => setCategory(e.target.value as SchoolinfoCategory)}>
            {Object.entries(SCHOOLINFO_CATEGORIES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="공시연도 (최근 3년만 제공)">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </Field>

        <Field label="시/도">
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
            동기화 완료 — 매칭 {result.matched}건 반영 (이름매칭 {result.matchedByName}건), 미매칭 {result.unmatched}건
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}
        {debug && (
          <div className="rounded-lg bg-surface-muted p-3 text-[11px] text-ink-500">
            진단정보: 시군구 {debug.districtsAttempted}곳 시도 중 {debug.districtsSucceeded}곳 성공, 받아온 원본 데이터{" "}
            {debug.totalRowsFetched}건
            {debug.districtSampleError && <p className="mt-1 text-status-danger">에러: {debug.districtSampleError}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleSync} disabled={syncing || levels.size === 0}>
            <Database size={14} /> {syncing ? "동기화 중..." : "동기화 실행"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
