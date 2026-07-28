"use client";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { limit, orderBy, where } from "firebase/firestore";
import { PIPELINE_STAGES, SchoolSummaryDoc, SchoolStatus } from "@/types";
import { GradeBadge } from "@/components/ui/Badge";
import { updateSchoolStatus } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { cn } from "@/lib/utils";

const STAGE_ACCENT: Record<SchoolStatus, string> = {
  신규: "border-t-gray-400",
  전화완료: "border-t-primary-500",
  자료발송: "border-t-violet-500",
  방문예정: "border-t-amber-500",
  시연: "border-t-sky-500",
  견적: "border-t-orange-500",
  협의중: "border-t-yellow-500",
  계약: "border-t-emerald-500",
  설치완료: "border-t-green-600",
  보류: "border-t-gray-300",
  실패: "border-t-red-400",
};

// 컬럼당 최대 100건만 조회 — 학교가 10만 건이어도 칸반보드 로딩비용은 일정하게 유지된다.
const COLUMN_LIMIT = 100;

export function KanbanBoard() {
  const { firebaseUser, userDoc } = useAuth();

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    if (!firebaseUser) return;
    await updateSchoolStatus(draggableId, destination.droppableId as SchoolStatus, firebaseUser.uid, userDoc?.name ?? "");
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} />
        ))}
      </div>
    </DragDropContext>
  );
}

function KanbanColumn({ stage }: { stage: SchoolStatus }) {
  // 각 컬럼이 독립적으로 실시간 구독 — status 필터 + limit(100)으로 bounded read 유지
  const { data: schools, loading } = useCollection<SchoolSummaryDoc>("schools_summary", [
    where("status", "==", stage),
    orderBy("updatedAt", "desc"),
    limit(COLUMN_LIMIT),
  ]);

  return (
    <Droppable droppableId={stage}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "flex w-64 shrink-0 flex-col rounded-xl border-t-4 bg-surface-muted",
            STAGE_ACCENT[stage],
            snapshot.isDraggingOver && "bg-primary-50/40"
          )}
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm font-semibold text-ink-900">{stage}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-ink-500 shadow-card">
              {loading ? "…" : schools.length >= COLUMN_LIMIT ? `${COLUMN_LIMIT}+` : schools.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 px-2 pb-2 min-h-[120px]">
            {schools.map((s, index) => (
              <Draggable draggableId={s.id} index={index} key={s.id}>
                {(dragProvided, dragSnapshot) => (
                  <Link
                    href={`/schools/${s.id}`}
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={cn(
                      "block rounded-lg border border-surface-border bg-white p-3 shadow-card",
                      dragSnapshot.isDragging && "shadow-pop ring-2 ring-primary-300"
                    )}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <GradeBadge grade={s.grade} />
                      <div className="flex items-center gap-1">
                        {s.aiScore != null && (
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-600">
                            AI {s.aiScore}
                          </span>
                        )}
                        {s.isNewlyOpened && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                            신설
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-ink-900">{s.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{s.region}</p>
                    <p className="mt-0.5 text-[11px] text-ink-300">담당 {s.ownerName ?? "-"}</p>
                  </Link>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}
