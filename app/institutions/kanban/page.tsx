"use client";

export const dynamic = "force-dynamic";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { AppShell } from "@/components/layout/AppShell";
import { GradeBadge } from "@/components/ui/Badge";
import { updateInstitutionStatus } from "@/lib/api/institutions";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { InstitutionDoc, PIPELINE_STAGES, SchoolStatus } from "@/types";
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

export default function InstitutionKanbanPage() {
  const { firebaseUser, userDoc } = useAuth();
  const isAdmin = userDoc?.role === "admin";
  // 관공서는 226곳 안팎으로 규모가 작아 컬럼당 limit 없이 전체를 한 번에 불러온다
  const { data: all } = useCollection<InstitutionDoc>("institutions", [orderBy("updatedAt", "desc")]);

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    if (!firebaseUser) return;
    await updateInstitutionStatus(draggableId, destination.droppableId as SchoolStatus);
  }

  return (
    <AppShell title="관공서 영업관리">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = all.filter((i) => i.status === stage);
            return (
              <Droppable droppableId={stage} key={stage}>
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
                        {items.length}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2 px-2 pb-2 min-h-[120px]">
                      {items.map((i, index) => {
                        const canDrag = isAdmin || i.ownerUid === firebaseUser?.uid;
                        return (
                          <Draggable draggableId={i.id} index={index} key={i.id} isDragDisabled={!canDrag}>
                            {(dragProvided, dragSnapshot) => (
                              <Link
                                href={`/institutions/${i.id}`}
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={cn(
                                  "block rounded-lg border border-surface-border bg-white p-3 shadow-card",
                                  dragSnapshot.isDragging && "shadow-pop ring-2 ring-primary-300",
                                  !canDrag && "opacity-70"
                                )}
                              >
                                <div className="mb-1.5 flex items-center justify-between">
                                  <GradeBadge grade={i.grade} />
                                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                                    {i.type}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-ink-900">{i.name}</p>
                                <p className="mt-0.5 text-xs text-ink-500">{i.region}</p>
                                <p className="mt-1">
                                  {i.ownerName ? (
                                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                                      담당 {i.ownerName}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
                                      담당자 미배정
                                    </span>
                                  )}
                                </p>
                              </Link>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </AppShell>
  );
}
