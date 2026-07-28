"use client";

export const dynamic = "force-dynamic";

import { useMemo, useRef, useState } from "react";
import { Plus, Upload, Download, FileDown, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { SchoolTable } from "@/components/schools/SchoolTable";
import { SchoolFormModal } from "@/components/schools/SchoolFormModal";
import { useCollection } from "@/lib/hooks/useCollection";
import { SchoolDoc, SchoolGrade, SchoolStatus } from "@/types";
import { exportSchoolsToExcel, parseSchoolExcel, downloadSchoolTemplate } from "@/lib/excel";
import { bulkImportSchools } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";

export default function SchoolsPage() {
  const { data: schools, loading } = useCollection<SchoolDoc>("schools");
  const { firebaseUser } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [regionFilter, setRegionFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<"전체" | SchoolStatus>("전체");
  const [gradeFilter, setGradeFilter] = useState<"전체" | SchoolGrade>("전체");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const regions = useMemo(() => Array.from(new Set(schools.map((s) => s.region))).sort(), [schools]);

  const filtered = useMemo(() => {
    return schools.filter((s) => {
      if (regionFilter !== "전체" && s.region !== regionFilter) return false;
      if (statusFilter !== "전체" && s.status !== statusFilter) return false;
      if (gradeFilter !== "전체" && s.grade !== gradeFilter) return false;
      if (keyword && !`${s.name}${s.address}${s.ownerName ?? ""}`.toLowerCase().includes(keyword.toLowerCase()))
        return false;
      return true;
    });
  }, [schools, regionFilter, statusFilter, gradeFilter, keyword]);

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
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="학교명, 주소, 담당자 검색"
            className="h-10 w-full rounded-lg border border-surface-border bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={downloadSchoolTemplate}>
            <FileDown size={14} /> 템플릿
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={14} /> {importing ? "업로드 중..." : "엑셀 업로드"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChange} />
          <Button variant="secondary" size="sm" onClick={() => exportSchoolsToExcel(filtered)}>
            <Download size={14} /> 엑셀 다운로드
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> 학교 등록
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="w-40">
          <option>전체</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-36">
          <option>전체</option>
          {["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as any)} className="w-28">
          <option>전체</option>
          {["A", "B", "C", "D"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <span className="flex items-center px-2 text-xs text-ink-500">
          총 {filtered.length}개교 {loading && "· 불러오는 중..."}
        </span>
      </div>

      <SchoolTable schools={filtered} />

      <SchoolFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
