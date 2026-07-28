"use client";

export const dynamic = "force-dynamic";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Route, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { KakaoSchoolMap } from "@/components/schools/KakaoSchoolMap";
import { SchoolSummaryDoc } from "@/types";
import { buildVisitRouteUrl } from "@/lib/route";
import { useAuth } from "@/lib/auth-context";

export default function SchoolsMapPage() {
  const { firebaseUser } = useAuth();
  const [visibleSchools, setVisibleSchools] = useState<SchoolSummaryDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [geocoding, setGeocoding] = useState(false);

  const handleVisibleChange = useCallback((schools: SchoolSummaryDoc[]) => {
    setVisibleSchools(schools);
  }, []);

  async function handleGeocode() {
    if (!firebaseUser) return;
    setGeocoding(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/schools/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      alert(`지오코딩 완료: ${json.success}건 성공 / ${json.failed}건 실패 (총 ${json.processed}건 처리)`);
    } catch (e: any) {
      alert(e.message || "지오코딩 중 오류가 발생했습니다.");
    } finally {
      setGeocoding(false);
    }
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRoute() {
    const addresses = visibleSchools.filter((s) => selectedIds.has(s.id)).map((s) => s.address).filter((a): a is string => !!a);
    const url = buildVisitRouteUrl(addresses);
    if (!url) {
      alert("주소가 있는 학교를 2곳 이상 선택하세요.");
      return;
    }
    window.open(url, "_blank");
  }

  return (
    <AppShell title="학교 지도">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/schools" className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
          <ArrowLeft size={14} /> 목록으로
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleGeocode} disabled={geocoding}>
            <MapPin size={14} /> {geocoding ? "지오코딩 중..." : "주소 좌표 변환 (50건)"}
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={handleRoute}>
              <Route size={14} /> 선택 {selectedIds.size}곳 방문동선 생성
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <KakaoSchoolMap onVisibleSchoolsChange={handleVisibleChange} />

        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-surface-border bg-white p-2">
          <p className="mb-2 px-2 text-xs font-semibold text-ink-500">현재 화면 내 학교 ({visibleSchools.length})</p>
          {visibleSchools.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 accent-primary-500"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-900">{s.name}</p>
                <p className="truncate text-[11px] text-ink-500">{s.region}</p>
              </div>
              {s.aiScore != null && <span className="text-[10px] font-semibold text-primary-600">{s.aiScore}점</span>}
            </label>
          ))}
          {visibleSchools.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-300">지도를 이동하면 학교가 표시됩니다.</p>}
        </div>
      </div>
    </AppShell>
  );
}
