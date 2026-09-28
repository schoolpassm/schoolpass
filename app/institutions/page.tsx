"use client";

export const dynamic = "force-dynamic";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { Plus, Phone, Mail, Search, Upload, FileDown, Loader2, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { StatusBadge, GradeBadge } from "@/components/ui/Badge";
import { useCollection } from "@/lib/hooks/useCollection";
import { InstitutionDoc, InstitutionType, SchoolStatus } from "@/types";
import { InstitutionFormModal } from "@/components/institutions/InstitutionFormModal";
import { InstitutionDashboardStats } from "@/components/institutions/InstitutionDashboardStats";
import { toTel, toMailto } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { bulkImportInstitutions } from "@/lib/api/institutions";
import { parseInstitutionExcel, downloadInstitutionTemplate } from "@/lib/institution-excel";

const TYPES: InstitutionType[] = [
  "시청",
  "군청",
  "구청",
  "소방서",
  "경찰서",
  "국방부·군기관",
  "기타 공공기관",
  "교육부",
  "교육청",
  "교육지원청",
];
const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료", "보류", "실패"];

export default function InstitutionsPage() {
  const { firebaseUser } = useAuth();
  const { data: institutions, loading } = useCollection<InstitutionDoc>("institutions", [orderBy("updatedAt", "desc")]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionDoc | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ success: 0, failed: 0 });
  const geocodeAfterIdRef = useRef<string | undefined>(undefined);

  /**
   * 좌표(위경도)가 없는 관공서를 전체 자동 순회하며 지오코딩한다 (스펙 14번 지도 표시용).
   * app/schools/map/page.tsx의 "전체 자동 순회"와 같은 패턴 — 중단돼도 이어서 재시도 가능.
   */
  async function handleAutoGeocode() {
    if (!firebaseUser) return;
    setGeocoding(true);
    let done = false;
    let guard = 0;
    try {
      while (!done && guard < 200) {
        guard += 1;
        const token = await firebaseUser.getIdToken();
        const res = await fetch("/api/institutions/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ afterId: geocodeAfterIdRef.current }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "지오코딩 실패");
        setGeocodeProgress((prev) => ({ success: prev.success + json.success, failed: prev.failed + json.failed }));
        geocodeAfterIdRef.current = json.lastId ?? geocodeAfterIdRef.current;
        done = json.done;
      }
      if (done) {
        alert("관공서 좌표 채우기가 끝났습니다. 방문동선 화면에서 지도에 표시됩니다.");
        geocodeAfterIdRef.current = undefined;
        setGeocodeProgress({ success: 0, failed: 0 });
      } else {
        alert("안전장치로 이번 실행을 멈췄습니다. 같은 버튼을 다시 누르면 이어서 진행됩니다.");
      }
    } catch (e: any) {
      alert((e.message || "지오코딩 중 오류가 발생했습니다.") + " — 다시 누르면 중단된 지점부터 이어서 진행됩니다.");
    } finally {
      setGeocoding(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setImporting(true);
    try {
      const rows = await parseInstitutionExcel(file);
      await bulkImportInstitutions(rows, firebaseUser.uid);
      alert(`${rows.length}건 업로드 완료`);
    } catch (err: any) {
      alert(err.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filtered = useMemo(() => {
    return institutions.filter((i) => {
      if (typeFilter && i.type !== typeFilter) return false;
      if (statusFilter && i.status !== statusFilter) return false;
      if (keyword && !i.name.includes(keyword) && !i.region.includes(keyword)) return false;
      return true;
    });
  }, [institutions, typeFilter, statusFilter, keyword]);

  return (
    <AppShell title="관공서 관리">
      <InstitutionDashboardStats institutions={institutions} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="기관명/지역 검색"
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
          <option value="">전체 유형</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">전체 상태</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Link href="/institutions/kanban">
          <Button variant="secondary" size="sm">
            칸반보드
          </Button>
        </Link>
        <Link href="/visit-planner">
          <Button variant="secondary" size="sm">
            <MapPin size={14} /> 방문동선
          </Button>
        </Link>
        <Button variant="secondary" size="sm" onClick={handleAutoGeocode} disabled={geocoding}>
          <MapPin size={14} />
          {geocoding ? `좌표 채우는 중... (성공 ${geocodeProgress.success} · 실패 ${geocodeProgress.failed})` : "좌표 채우기 (지도용)"}
        </Button>
        <Button variant="secondary" size="sm" onClick={downloadInstitutionTemplate}>
          <FileDown size={14} /> 템플릿
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 엑셀 일괄등록
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={14} /> 관공서 등록
        </Button>
        <span className="ml-auto text-xs text-ink-500">{loading ? "불러오는 중..." : `총 ${filtered.length}곳`}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border bg-white shadow-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">기관명</th>
              <th className="px-4 py-3 font-medium">유형</th>
              <th className="px-4 py-3 font-medium">지역</th>
              <th className="px-4 py-3 font-medium">담당자</th>
              <th className="px-4 py-3 font-medium">영업담당</th>
              <th className="px-4 py-3 font-medium">등급</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">빠른연락</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-b border-surface-border last:border-0 hover:bg-surface-muted/60">
                <td className="px-4 py-3">
                  <Link href={`/institutions/${i.id}`} className="font-medium text-ink-900 hover:text-primary-600">
                    {i.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-500">{i.type}</td>
                <td className="px-4 py-3 text-ink-500">{i.region}</td>
                <td className="px-4 py-3 text-ink-500">
                  {i.contactName ? `${i.contactName}${i.contactTitle ? ` (${i.contactTitle})` : ""}` : "-"}
                </td>
                <td className="px-4 py-3 text-ink-500">{i.ownerName ?? "-"}</td>
                <td className="px-4 py-3">
                  <GradeBadge grade={i.grade} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={i.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <a href={toTel(i.contactPhone || i.phone)} className="text-ink-400 hover:text-primary-600">
                      <Phone size={14} />
                    </a>
                    <a href={toMailto(i.contactEmail)} className="text-ink-400 hover:text-primary-600">
                      <Mail size={14} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-ink-300">
                  등록된 관공서가 없습니다. 위 "관공서 등록" 버튼으로 추가하세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InstitutionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        institution={editing ?? undefined}
      />
    </AppShell>
  );
}
