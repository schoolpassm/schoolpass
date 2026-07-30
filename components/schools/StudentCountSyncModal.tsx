"use client";

import { useState } from "react";
import { addDoc, collection, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { Database, History } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { db } from "@/lib/firebase";
import { SCHOOLINFO_LEVEL_CODES, SCHOOLINFO_CATEGORIES, SchoolinfoCategory } from "@/lib/schoolinfo";
import { SIGUNGU_CODES } from "@/lib/schoolinfo-regions";
import { formatDate } from "@/lib/utils";

const SIDO_OPTIONS = Array.from(
  new Map(SIGUNGU_CODES.filter((s) => s.sidoCode !== "00").map((s) => [s.sidoCode, s.sidoName])).entries()
);

interface SyncLogDoc {
  category: string;
  categoryLabel: string;
  year: number;
  sidoName: string;
  matched: number;
  unmatched: number;
  failedChunks: number;
  createdByName: string;
  createdAt: any;
}

interface Totals {
  matched: number;
  matchedByName: number;
  unmatched: number;
  rowCount: number;
  failedChunks: number;
  unmatchedSample: string[];
}

const ALL_SIDO_VALUE = "ALL";

export function StudentCountSyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser, userDoc } = useAuth();
  const { data: recentLogs } = useCollection<SyncLogDoc>("sync_logs", [orderBy("createdAt", "desc"), limit(5)]);
  const [category, setCategory] = useState<SchoolinfoCategory>("student_count");
  const [year, setYear] = useState(new Date().getFullYear());
  const [levels, setLevels] = useState<Set<string>>(new Set(["02"]));
  const [sidoCode, setSidoCode] = useState(SIDO_OPTIONS[0]?.[0] ?? "");
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [currentSidoLabel, setCurrentSidoLabel] = useState<string | null>(null);
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

  async function callChunk(levelCode: string, sggCode: string, thisSidoCode: string, regionHint: string, token: string) {
    const res = await fetch("/api/schools/sync-public-data-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category, year, levelCode, sggCode, sidoCode: thisSidoCode, regionHint }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "청크 동기화 실패");
    return json as { matched: number; matchedByName: number; unmatched: number; rowCount: number; unmatchedSample: string[] };
  }

  /** 시/도 하나에 대한 전체 작업(레벨×시군구)을 처리하고 누계에 더한다 */
  async function runOneSido(thisSidoCode: string, thisSidoName: string, token: string, totals: Totals, overallDoneRef: { done: number; total: number }) {
    const districts = SIGUNGU_CODES.filter((s) => s.sidoCode === thisSidoCode && s.sggCode !== "00000");
    const tasks: { levelCode: string; sggCode: string }[] = [];
    for (const levelCode of levels) {
      for (const d of districts) tasks.push({ levelCode, sggCode: d.sggCode });
    }

    const CONCURRENCY = 3;
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const batch = tasks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (t) => {
          const attempts = [0, 1000, 2500];
          let lastErr: any = null;
          for (const delay of attempts) {
            if (delay > 0) await new Promise((r) => setTimeout(r, delay));
            try {
              return await callChunk(t.levelCode, t.sggCode, thisSidoCode, thisSidoName, token);
            } catch (e: any) {
              lastErr = e;
            }
          }
          setLastError(lastErr?.message || String(lastErr));
          totals.failedChunks += 1;
          return null;
        })
      );
      for (const r of results) {
        if (!r) continue;
        totals.matched += r.matched;
        totals.matchedByName += r.matchedByName;
        totals.unmatched += r.unmatched;
        totals.rowCount += r.rowCount;
        if (r.unmatchedSample && totals.unmatchedSample.length < 15) {
          totals.unmatchedSample.push(...r.unmatchedSample.slice(0, 15 - totals.unmatchedSample.length));
        }
      }
      overallDoneRef.done += Math.min(CONCURRENCY, batch.length);
      setProgress({ done: overallDoneRef.done, total: overallDoneRef.total });
    }
  }

  async function handleSync() {
    if (!firebaseUser) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    setLastError(null);
    setCurrentSidoLabel(null);

    const isAllSido = sidoCode === ALL_SIDO_VALUE;
    const targetSidos = isAllSido ? SIDO_OPTIONS : SIDO_OPTIONS.filter(([code]) => code === sidoCode);

    // 전체 작업 개수를 미리 계산해 진행률 분모로 사용
    let totalTasks = 0;
    for (const [code] of targetSidos) {
      const districtCount = SIGUNGU_CODES.filter((s) => s.sidoCode === code && s.sggCode !== "00000").length;
      totalTasks += districtCount * levels.size;
    }
    const overallDoneRef = { done: 0, total: totalTasks };
    setProgress({ done: 0, total: totalTasks });

    const totals: Totals = { matched: 0, matchedByName: 0, unmatched: 0, rowCount: 0, failedChunks: 0, unmatchedSample: [] };

    try {
      const token = await firebaseUser.getIdToken();
      for (const [code, name] of targetSidos) {
        setCurrentSidoLabel(name);
        await runOneSido(code, name, token, totals, overallDoneRef);
      }
      setResult(totals);
      setCurrentSidoLabel(null);
      try {
        await addDoc(collection(db, "sync_logs"), {
          category,
          categoryLabel: SCHOOLINFO_CATEGORIES[category].label,
          year,
          sidoName: isAllSido ? "전국" : targetSidos[0]?.[1] ?? "",
          matched: totals.matched,
          unmatched: totals.unmatched,
          failedChunks: totals.failedChunks,
          createdByName: userDoc?.name ?? "",
          createdAt: serverTimestamp(),
        });
      } catch {
        // 이력 기록 실패는 동기화 결과 자체에 영향 없으므로 조용히 무시
      }
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
            <option value={ALL_SIDO_VALUE}>🌏 전국 (17개 시/도 자동 순회 — 시간이 오래 걸립니다)</option>
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
                {currentSidoLabel && `${currentSidoLabel} 처리 중 · `}진행 중... ({progress.done}/{progress.total})
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
        {result && result.unmatchedSample.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-700">
            <p className="mb-1 font-medium">매칭 안 된 학교명 샘플 (최대 15개):</p>
            <p>{result.unmatchedSample.join(", ")}</p>
            <p className="mt-1 text-amber-600">
              보통 학교명 표기 차이(공백/괄호 등) 또는 아직 DB에 없는 학교인 경우입니다.
            </p>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}
        {lastError && <p className="text-[11px] text-status-danger">최근 실패 사유: {lastError}</p>}

        {recentLogs.length > 0 && (
          <div className="rounded-lg border border-surface-border p-3">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-ink-500">
              <History size={12} /> 최근 동기화 이력
            </p>
            <ul className="space-y-1 text-[11px] text-ink-500">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex justify-between">
                  <span>
                    {log.categoryLabel} · {log.sidoName} · {log.year}년
                  </span>
                  <span>
                    매칭 {log.matched}건 · {formatDate(log.createdAt, true)}
                  </span>
                </li>
              ))}
            </ul>
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
