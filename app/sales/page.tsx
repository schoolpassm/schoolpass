"use client";

export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { KanbanBoard } from "@/components/sales/KanbanBoard";

export default function SalesPage() {
  return (
    <AppShell title="영업관리">
      <p className="mb-3 text-xs text-ink-500">
        카드를 드래그해서 단계를 변경하세요. 각 단계별 최대 100건까지 표시됩니다.
      </p>
      <KanbanBoard />
    </AppShell>
  );
}
