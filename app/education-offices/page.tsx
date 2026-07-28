"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useCollection } from "@/lib/hooks/useCollection";
import { EducationOfficeDoc } from "@/types";
import { EduOfficeCard } from "@/components/education-offices/EduOfficeCard";
import { EduOfficeFormModal } from "@/components/education-offices/EduOfficeFormModal";

export default function EducationOfficesPage() {
  const { data: offices, loading } = useCollection<EducationOfficeDoc>("educationOffices");
  const [formOpen, setFormOpen] = useState(false);

  return (
    <AppShell title="교육지원청">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500">총 {offices.length}개 교육지원청 {loading && "· 불러오는 중..."}</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 교육지원청 등록
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {offices.map((o) => (
          <EduOfficeCard key={o.id} office={o} />
        ))}
        {offices.length === 0 && !loading && (
          <p className="col-span-full rounded-lg border border-dashed border-surface-border py-16 text-center text-sm text-ink-300">
            등록된 교육지원청이 없습니다.
          </p>
        )}
      </div>

      <EduOfficeFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
