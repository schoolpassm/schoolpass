"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Upload, Download, FileDown, Search, RefreshCw, Route, Map as MapIcon, Loader2, Users, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { SchoolTable } from "@/components/schools/SchoolTable";
import { SchoolFormModal } from "@/components/schools/SchoolFormModal";
import { NeisSyncModal } from "@/components/schools/NeisSyncModal";
import { StudentCountSyncModal } from "@/components/schools/StudentCountSyncModal";
import { BulkScoreModal } from "@/components/schools/BulkScoreModal";
import { useSchoolsPaginated } from "@/lib/hooks/useSchoolsPaginated";
import { useInfiniteScrollSentinel } from "@/lib/hooks/useInfiniteScrollSentinel";
import { SchoolGrade, SchoolLevel, SchoolStatus } from "@/types";
import { exportSchoolsToExcel, parseSchoolExcel, downloadSchoolTemplate } from "@/lib/excel";
import { bulkImportSchools } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { buildVisitRouteUrl } from "@/lib/route";
import { NEIS_REGION_CODES } from "@/lib/neis";

// useSearchParams()를 쓰는 부분은 반드시 Suspense 경계 안에 있어야 하므로
// 실제 페이지 내용은 SchoolsPageInner로 분리하고, 아래에서 감싸서 export한다.
export default function SchoolsPage() {
  return (
    <Suspense fallback={null}>
      <SchoolsPageInner />
    </Suspense>
  );
}

function SchoolsPageInner() {
  const { firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [neisOpen, setNeisOpen] = useState(false);
  const [studentCountOpen, setStudentCountOpen] = useState(false);
  const [bulkScoreOpen, setBulkScoreOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [namePrefix, setNamePrefix] = useState("");
  // 대시보드 통계카드 클릭 등으로 ?status=계약 형태 URL을 넘어오면 그 값으로 초기 필터를 맞춘다.
  const [regionFilter, setRegionFilter] = useState<string | undefined>(searchParams.get("region") || undefined);
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | undefined>(
    (searchParams.get("status") as SchoolStatus) || undefined
  );
  const [gradeFilter, setGradeFilter] = useState<SchoolGrade | undefined>(
    (searchParams.get("grade") as SchoolGrade) || undefined
  );
  const [levelFilter, setLevelFilter] = useState<SchoolLevel | undefined>(
    (searchParams.get("level") as SchoolLevel) || undefined
  );
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = useMemo(
    () => ({
      region: regionFilter,
      status: statusFilter,
      grade: gradeFilter,
      level: levelFilter,
      namePrefix: namePrefix || undefined,
    }),
    [regionFilter, statusFilter, gradeFilter, levelFilter, namePrefix]
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useSchoolsPaginated(filters);
  const schools = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const sentinelRef = useInfiniteScrollSentinel(
    useCallback(() => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]),
    !isLoading
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNamePrefix(keywordInput.trim());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleVisitRoute() {
    const selectedSchools = schools.filter((s) => selectedIds.has(s.id));
    const addresses = selectedSchools.map((s) => s.address).filter((a): a is string => !!a);
    const url = buildVisitRouteUrl(addresses);
    if (!url) {
      alert("주소가 등록된 학교를 2곳 이상 선택해주세요.");
      return;
    }
    window.open(url, "_blank");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setImporting(true);
    try {
      const rows = await parseSchoolExcel(file);
      await bulkImportSchools(rows, firebaseUser.uid);
      alert(`${rows.length}건 업로드 완료`);
    } catch (err) {
      alert("엑셀 업로드 중 오류가 발생했습니다. 템플릿 형식을 확인하세요.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <AppShell title="학교관리">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="학교명 앞글자로 검색 (예: 용신)"
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href="/schools/map">
            <Button variant="secondary" size="sm">
              <MapIcon size={14} /> 지도 보기
            </Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => setNeisOpen(true)}>
            <RefreshCw size={14} /> 학교알리미 동기화
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setStudentCountOpen(true)}>
            <Users size={14} /> 공공데이터 동기화
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setBulkScoreOpen(true)}>
            <Sparkles size={14} /> AI 점수 일괄 매기기
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadSchoolTemplate}>
            <FileDown size={14} /> 템플릿
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={14} /> {importing ? "업로드 중..." : "엑셀 업로드"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
          <Button variant="secondary" size="sm" onClick={() => exportSchoolsToExcel(schools)}>
            <Download size={14} /> 현재 목록 다운로드
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> 학교 등록
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={regionFilter ?? ""} onChange={(e) => setRegionFilter(e.target.value || undefined)} className="w-44">
          <option value="">전체 지역</option>
          {NEIS_REGION_CODES.map((r) => (
            <option key={r.code} value={r.provinceName}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          value={levelFilter ?? ""}
          onChange={(e) => setLevelFilter((e.target.value || undefined) as SchoolLevel | undefined)}
          className="w-32"
        >
          <option value="">전체 학교급</option>
          {["초등학교", "중학교", "고등학교", "특수학교", "유치원"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter ?? ""}
          onChange={(e) => setStatusFilter((e.target.value || undefined) as SchoolStatus | undefined)}
          className="w-36"
        >
          <option value="">전체 상태</option>
          {["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={gradeFilter ?? ""}
          onChange={(e) => setGradeFilter((e.target.value || undefined) as SchoolGrade | undefined)}
          className="w-28"
        >
          <option value="">전체 등급</option>
          {["A", "B", "C", "D"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <span className="flex items-center px-2 text-xs text-ink-500">
          {schools.length}개 불러옴 {isLoading && "· 불러오는 중..."}
        </span>
        {selectedIds.size > 0 && (
          <Button variant="secondary" size="sm" onClick={handleVisitRoute}>
            <Route size={14} /> 선택 {selectedIds.size}곳 방문동선 생성
          </Button>
        )}
      </div>

      <SchoolTable schools={schools} selectedIds={selectedIds} onToggleSelect={toggleSelect} />

      {/* 무한스크롤 sentinel — 화면에 보이면 다음 50건을 자동으로 더 불러옴 */}
      <div ref={sentinelRef} className="flex justify-center py-6">
        {isFetchingNextPage && <Loader2 size={18} className="animate-spin text-primary-400" />}
        {!hasNextPage && !isLoading && schools.length > 0 && (
          <p className="text-xs text-ink-300">마지막 학교까지 모두 불러왔습니다.</p>
        )}
      </div>

      <SchoolFormModal open={formOpen} onClose={() => setFormOpen(false)} />
      <NeisSyncModal open={neisOpen} onClose={() => setNeisOpen(false)} />
      <StudentCountSyncModal open={studentCountOpen} onClose={() => setStudentCountOpen(false)} />
      <BulkScoreModal open={bulkScoreOpen} onClose={() => setBulkScoreOpen(false)} />
    </AppShell>
  );
}
