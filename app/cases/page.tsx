"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCollection } from "@/lib/hooks/useCollection";
import { CaseDoc } from "@/types";
import { CaseFormModal } from "@/components/cases/CaseFormModal";

export default function CasesPage() {
  const { data: cases, loading } = useCollection<CaseDoc>("cases");
  const [formOpen, setFormOpen] = useState(false);

  return (
    <AppShell title="구축사례">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500">총 {cases.length}건 구축사례 {loading && "· 불러오는 중..."}</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 구축사례 등록
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            {c.photos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photos[0]} alt={c.schoolName} className="h-40 w-full object-cover" />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-surface-muted text-ink-300">
                <FileText size={28} />
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-semibold text-ink-900">{c.schoolName}</p>
              <p className="text-xs text-ink-500">{c.region} · {c.installYear}년 설치</p>
              {c.review && <p className="mt-2 text-xs text-ink-700 line-clamp-2">{c.review}</p>}
              {c.fileUrls?.length > 0 && (
                <a href={c.fileUrls[0]} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                  <FileText size={12} /> 첨부 PDF 보기
                </a>
              )}
            </div>
          </Card>
        ))}
        {cases.length === 0 && !loading && (
          <p className="col-span-full rounded-lg border border-dashed border-surface-border py-16 text-center text-sm text-ink-300">
            등록된 구축사례가 없습니다.
          </p>
        )}
      </div>

      <CaseFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </AppShell>
  );
}
