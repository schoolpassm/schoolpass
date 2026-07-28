"use client";

export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/sales/KanbanBoard";
import { useCollection } from "@/lib/hooks/useCollection";
import { SchoolDoc } from "@/types";

export default function SalesPage() {
  const { data: schools, loading } = useCollection<SchoolDoc>("schools");

  return (
    <AppShell title="영업관리">
      <p className="mb-3 text-xs text-ink-500">카드를 드래그해서 단계를 변경하세요. {loading && "· 불러오는 중..."}</p>
      <KanbanBoard schools={schools} />
    </AppShell>
  );
}
