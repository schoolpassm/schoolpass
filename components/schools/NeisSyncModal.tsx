"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth-context";
import { NEIS_REGION_CODES } from "@/lib/neis";

export function NeisSyncModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [regionCode, setRegionCode] = useState(NEIS_REGION_CODES[0].code);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; closedDetected?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    if (!firebaseUser) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/schools/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ regionCodes: [regionCode] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "동기화 실패");
      setResult({ created: json.created, updated: json.updated, closedDetected: json.closedDetected });
    } catch (e: any) {
      setError(e.message || "동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학교알리미(NEIS) 자동 동기화">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          나이스 교육정보 개방포털의 학교기본정보를 가져와 학교명·주소·전화번호·학교급을 자동으로 등록/갱신합니다.
          영업 상태(등급·담당자·태그·메모)는 덮어쓰지 않습니다.
        </p>
        <Field label="교육청 (시/도)">
          <Select value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
            {NEIS_REGION_CODES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        {result && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            동기화 완료 — 신규 {result.created}건, 갱신 {result.updated}건
            {typeof result.closedDetected === "number" && result.closedDetected > 0 && `, 폐교 감지 ${result.closedDetected}건`}
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "동기화 중... (수 분 소요될 수 있음)" : "동기화 실행"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
