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

interface Totals {
  matched: number;
  matchedByName: number;
  unmatched: number;
  rowCount: number;
  failedChunks: number;
}

export function StudentCountSyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [category, setCategory] = useState<SchoolinfoCategory>("student_count");
  const [year, setYear] = useState(new Date().getFullYear());
  const [levels, setLevels] = useState<Set<string>>(new Set(["02"]));
  const [sidoCode, setSidoCode] = useState(SIDO_OPTIONS[0]?.[0] ?? "");
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  function toggleLevel(code: string) {
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function callChunk(levelCode: string, sggCode: string, regionHint: string, token: string) {
    const res = await fetch("/api/schools/sync-public-data-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category, year, levelCode, sggCode, sidoCode, regionHint }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "청크 동기화 실패");
    return json as { matched: number; matchedByName: number; unmatched: number; rowCount: number };
  }

  async function handleSync() {
    if (!firebaseUser) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    setLastError(null);

    const districts = SIGUNGU_CODES.filter((s) => s.sidoCode === sidoCode && s.sggCode !== "00000");
    const regionHint = districts[0]?.sidoName ?? "";
    const tasks: { levelCode: string; sggCode: string }[] = [];
    for (const levelCode of levels) {
      for (const d of districts) tasks.push({ levelCode, sggCode: d.sggCode });
    }
    setProgress({ done: 0, total: tasks.length });

    const totals: Totals = { matched: 0, matchedByName: 0, unmatched: 0, rowCount: 0, failedChunks: 0 };

    try {
      const token = await firebaseUser.getIdToken();
      const CONCURRENCY = 3;
      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (t) => {
            try {
              return await callChunk(t.levelCode, t.sggCode, regionHint, token);
            } catch (e: any) {
              setLastError(e.message || String(e));
              totals.failedChunks += 1;
              return null;
            }
          })
        );
        for (const r of results) {
          if (!r) continue;
          totals.matched += r.matched;
          totals.matchedByName += r.matchedByName;
          totals.unmatched += r.unmatched;
          totals.rowCount += r.rowCount;
        }
        setProgress({ done: Math.min(i + CONCURRENCY, tasks.length), total: tasks.length });
      }
      setResult(totals);
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
          학교알리미(schoolinfo.go.kr) 공시자료를 시군구 단위로 잘게 나눠 순차 호출합니다 (Hobby 플랜 타임아웃 방지).
          이름+지역으로 매칭하며, 동명 학교가 여럿이면 안전하게 건너뜁니다.
        </p>

        <Field label="데이터 종류">
          <Select value={category} onChange={(e) => setCategory(e.target.value as SchoolinfoCategory)} disabled={syncing}>
            {Object.entries(SCHOOLINFO_CATEGORIES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="공시연도 (최근 3년만 제공)">
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={syncing} />
        </Field>

        <Field label="시/도">
          <Select value={sidoCode} onChange={(e) => setSidoCode(e.target.value)} disabled={syncing}>
            {SIDO_OPTIONS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-500">
            대상 학교급 (여러 개 선택하면 그만큼 오래 걸립니다 — 처음엔 1개만 추천)
          </p>
          <div className="flex flex-wrap gap-2">
            {SCHOOLINFO_LEVEL_CODES.map((l) => (
              <label key={l.code} className="flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={levels.has(l.code)}
                  onChange={() => toggleLevel(l.code)}
                  disabled={syncing}
                  className="accent-primary-500"
                />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        {syncing && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-500">
              <span>
                진행 중... ({progress.done}/{progress.total})
              </span>
              <span>{progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-primary-500 transition-all"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            동기화 완료 — 매칭 {result.matched}건 반영 (이름매칭 {result.matchedByName}건), 미매칭 {result.unmatched}건, 원본{" "}
            {result.rowCount}건
            {result.failedChunks > 0 && ` · 실패한 요청 ${result.failedChunks}건`}
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}
        {lastError && <p className="text-[11px] text-status-danger">최근 실패 사유: {lastError}</p>}

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
