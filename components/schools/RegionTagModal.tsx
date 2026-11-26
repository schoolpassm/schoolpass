"use client";

import { useState } from "react";
import { arrayUnion, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { NEIS_REGION_CODES } from "@/lib/neis";
import { SchoolSummaryDoc } from "@/types";

/**
 * 주소 키워드로 학교에 태그를 일괄 지정한다 (예: 경기도 + "용인" → 태그 "용인").
 * 지역 프리셋("용인 전용 보기")은 이 태그를 기준으로 동작한다.
 *
 * 1단계 [미리보기]: 선택한 시/도의 학교를 한 번 읽어 주소에 키워드가 들어간 곳만 센다(쓰기 없음).
 * 2단계 [태그 지정]: 미리보기에서 찾은 학교에만 태그를 추가한다(arrayUnion이라 기존 태그는 유지, 중복 없음).
 * 읽기는 선택한 시/도의 학교 수만큼(경기도 약 2천여 건) 한 번 발생한다 — 무료 요금제 일일 한도를 고려해 미리보기는 필요할 때만 누르세요.
 */
export function RegionTagModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaultRegion = NEIS_REGION_CODES.find((r) => r.provinceName.includes("경기"))?.provinceName ?? NEIS_REGION_CODES[0].provinceName;
  const [region, setRegion] = useState(defaultRegion);
  const [keyword, setKeyword] = useState("용인");
  const [tag, setTag] = useState("용인");
  const [busy, setBusy] = useState<"scan" | "apply" | null>(null);
  const [matched, setMatched] = useState<SchoolSummaryDoc[] | null>(null);
  const [scanned, setScanned] = useState(0);
  const [noAddress, setNoAddress] = useState(0);
  const [alreadyTagged, setAlreadyTagged] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function scan() {
    setBusy("scan");
    setMessage(null);
    setMatched(null);
    try {
      const snap = await getDocs(query(collection(db, "schools_summary"), where("region", "==", region)));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc);
      const kw = keyword.trim();
      const hits = all.filter((s) => (s.address ?? "").includes(kw) || (s.district ?? "").includes(kw));
      setScanned(all.length);
      setNoAddress(all.filter((s) => !s.address).length);
      setAlreadyTagged(hits.filter((s) => (s.tags ?? []).includes(tag.trim())).length);
      setMatched(hits);
    } catch (e: any) {
      setMessage(`조회 실패: ${e?.message ?? "알 수 없는 오류"} (무료 요금제 일일 한도 초과일 수 있어요)`);
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!matched || matched.length === 0 || !tag.trim()) return;
    setBusy("apply");
    setMessage(null);
    try {
      const t = tag.trim();
      const targets = matched.filter((s) => !(s.tags ?? []).includes(t));
      // 학교 1곳당 쓰기 2번(상세+요약) → 200곳씩 끊어 배치(500 제한 안쪽)
      for (let i = 0; i < targets.length; i += 200) {
        const batch = writeBatch(db);
        for (const s of targets.slice(i, i + 200)) {
          batch.update(doc(db, "schools_detail", s.id), { tags: arrayUnion(t), updatedAt: serverTimestamp() });
          batch.set(doc(db, "schools_summary", s.id), { tags: arrayUnion(t) }, { merge: true });
        }
        await batch.commit();
      }
      setMessage(`완료: ${targets.length}곳에 "${t}" 태그를 지정했습니다. (이미 지정돼 있던 ${matched.length - targets.length}곳은 그대로)`);
      setAlreadyTagged(matched.length);
    } catch (e: any) {
      setMessage(`태그 지정 실패: ${e?.message ?? "알 수 없는 오류"} — 일부만 반영됐을 수 있으니 미리보기를 다시 눌러 확인하세요.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="지역 프리셋 태그 지정 (용인 전용 보기 등)" width="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-ink-500">
          시/도를 고르고 주소에 들어갈 키워드를 넣으면, 해당 학교들에 태그를 일괄로 붙입니다. 붙인 뒤에는 학교관리 화면의 프리셋 칩으로 그 학교만 모아볼 수 있습니다.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="시/도">
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              {NEIS_REGION_CODES.map((r) => (
                <option key={r.code} value={r.provinceName}>
                  {r.provinceName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="주소 키워드">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 용인" />
          </Field>
          <Field label="붙일 태그">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="예: 용인" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={scan} disabled={!!busy || !keyword.trim()}>
            {busy === "scan" ? "조회 중..." : "1. 미리보기 (읽기만)"}
          </Button>
          <Button size="sm" onClick={apply} disabled={!!busy || !matched || matched.length === 0 || !tag.trim()}>
            {busy === "apply" ? "지정 중..." : `2. 태그 지정${matched ? ` (${matched.length}곳)` : ""}`}
          </Button>
        </div>

        {matched && (
          <div className="rounded-lg border border-surface-border bg-surface-muted p-3 text-xs text-ink-700">
            <p>
              {region} 학교 {scanned.toLocaleString()}곳 중 주소에 "{keyword}"가 들어간 학교: <b>{matched.length}곳</b>
              {alreadyTagged > 0 && ` (이미 "${tag}" 태그 있음 ${alreadyTagged}곳)`}
            </p>
            {noAddress > 0 && (
              <p className="mt-1 text-amber-700">
                주소가 비어 있어 판별할 수 없는 학교 {noAddress.toLocaleString()}곳은 제외됐습니다 (공공데이터 동기화로 주소를 채운 뒤 다시 실행하세요).
              </p>
            )}
            {matched.length > 0 && (
              <p className="mt-2 text-ink-500">
                예: {matched.slice(0, 6).map((s) => s.name).join(", ")}
                {matched.length > 6 && " …"}
              </p>
            )}
          </div>
        )}
        {message && <p className="text-xs font-medium text-primary-700">{message}</p>}
      </div>
    </Modal>
  );
}
