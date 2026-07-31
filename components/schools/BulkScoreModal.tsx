"use client";

import { useState } from "react";
import { collection, getDocs, limit, query, where, orderBy as fbOrderBy } from "firebase/firestore";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { updateSchool } from "@/lib/api/schools";
import { SchoolStatus, SchoolSummaryDoc } from "@/types";
import { NEIS_REGION_CODES } from "@/lib/neis";

const STATUS_OPTIONS: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중"];
const MAX_COUNT_OPTIONS = [20, 50, 100, 200];

interface ScoreResult {
  score: number | null;
  factors: { label: string; positive: boolean }[];
  text: string;
}

export function BulkScoreModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [status, setStatus] = useState<SchoolStatus | "">("");
  const [region, setRegion] = useState("");
  const [onlyUnscored, setOnlyUnscored] = useState(true);
  const [maxCount, setMaxCount] = useState(50);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [scoredCount, setScoredCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function callScore(schoolId: string, token: string): Promise<ScoreResult> {
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ schoolId, action: "score" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "점수 산정 실패");
    return { score: json.score, factors: json.factors ?? [], text: json.text };
  }

  async function handleRun() {
    if (!firebaseUser) return;
    setRunning(true);
    setError(null);
    setScoredCount(0);
    setFailedCount(0);

    try {
      // 대상 학교 조회 (bounded — 화면에서 고른 필터 + 최대 개수만큼만)
      const constraints = [] as any[];
      if (status) constraints.push(where("status", "==", status));
      if (region) constraints.push(where("region", "==", region));
      // 최근 업데이트순으로 넉넉히 가져온 뒤(최대개수의 3배), "점수 없음" 조건은 클라이언트에서 필터링
      constraints.push(fbOrderBy("updatedAt", "desc"));
      constraints.push(limit(maxCount * (onlyUnscored ? 3 : 1)));

      const snap = await getDocs(query(collection(db, "schools_summary"), ...constraints));
      let targets = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc);
      if (onlyUnscored) targets = targets.filter((s) => s.aiScore == null);
      targets = targets.slice(0, maxCount);

      setProgress({ done: 0, total: targets.length });
      const token = await firebaseUser.getIdToken();

      const CONCURRENCY = 2; // AI 호출은 순차 부하를 낮게 유지 (비용/속도 균형)
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (school) => {
            try {
              const result = await callScore(school.id, token);
              if (result.score != null) {
                await updateSchool(school.id, {
                  aiScore: result.score,
                  aiScoreReason: result.text,
                  aiScoreFactors: result.factors,
                });
                setScoredCount((c) => c + 1);
              } else {
                setFailedCount((c) => c + 1);
              }
            } catch {
              setFailedCount((c) => c + 1);
            }
          })
        );
        setProgress({ done: Math.min(i + CONCURRENCY, targets.length), total: targets.length });
      }
    } catch (e: any) {
      setError(e.message || "일괄 처리 중 오류가 발생했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="AI 계약가능성 점수 일괄 매기기" width="max-w-lg">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          선택한 조건에 맞는 학교들에 AI 계약가능성 점수를 자동으로 매기고 저장합니다.
          Haiku 모델 기준 건당 몇 원 수준으로 저렴하지만, 학교 수가 많으면 시간이 걸립니다.
        </p>

        <Field label="상태 필터 (선택 안 하면 전체)">
          <Select value={status} onChange={(e) => setStatus(e.target.value as SchoolStatus | "")} disabled={running}>
            <option value="">전체</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="지역 필터 (선택 안 하면 전체)">
          <Select value={region} onChange={(e) => setRegion(e.target.value)} disabled={running}>
            <option value="">전체</option>
            {NEIS_REGION_CODES.map((r) => (
              <option key={r.code} value={r.provinceName}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="최대 처리 개수 (비용/시간 조절용)">
          <Select value={maxCount} onChange={(e) => setMaxCount(Number(e.target.value))} disabled={running}>
            {MAX_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={onlyUnscored}
            onChange={(e) => setOnlyUnscored(e.target.checked)}
            disabled={running}
            className="accent-primary-500"
          />
          아직 점수 없는 학교만 (체크 해제 시 이미 점수 있는 학교도 다시 채점)
        </label>

        {running && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-500">
              <span>
                채점 중... ({progress.done}/{progress.total}) · 성공 {scoredCount} · 실패 {failedCount}
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
        {!running && progress.total > 0 && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            완료 — {scoredCount}개 학교 채점 완료, {failedCount}개 실패
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleRun} disabled={running}>
            <Sparkles size={14} className={running ? "animate-pulse" : ""} /> {running ? "채점 중..." : "일괄 채점 실행"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
