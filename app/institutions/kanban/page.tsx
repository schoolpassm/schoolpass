"use client";

export const dynamic = "force-dynamic";

import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GradeBadge } from "@/components/ui/Badge";
import { updateInstitutionPublicStage } from "@/lib/api/institutions";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { InstitutionDoc, PublicPipelineStage, PUBLIC_PIPELINE_STAGES } from "@/types";
import { getPublicStage, getDaysInStage, isStalled, stageAccent } from "@/lib/public-pipeline";
import { cn } from "@/lib/utils";

export default function InstitutionKanbanPage() {
  const { firebaseUser, userDoc } = useAuth();
  const isAdmin = userDoc?.role === "admin";
  // 관공서는 226곳 안팎으로 규모가 작아 컬럼당 limit 없이 전체를 한 번에 불러온다
  const { data: all } = useCollection<InstitutionDoc>("institutions", [orderBy("updatedAt", "desc")]);

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    if (!firebaseUser) return;
    await updateInstitutionPublicStage(draggableId, destination.droppableId as PublicPipelineStage);
  }

  const stalledCount = all.filter((i) => isStalled(i)).length;

  return (
    <AppShell title="관공서 영업관리 (공공영업 파이프라인)">
      {stalledCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle size={14} />
          현재 단계에서 14일 이상 정체된 기관이 {stalledCount}곳 있습니다. 카드의 주황색 배지를 확인하세요.
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PUBLIC_PIPELINE_STAGES.map((stage) => {
            const items = all.filter((i) => getPublicStage(i) === stage);
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex w-64 shrink-0 flex-col rounded-xl border-t-4 bg-surface-muted",
                      stageAccent(stage),
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
                        const days = getDaysInStage(i);
                        const stalled = isStalled(i);
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
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {i.ownerName ? (
                                    <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                                      담당 {i.ownerName}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
                                      담당자 미배정
                                    </span>
                                  )}
                                  {stalled && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                      <AlertTriangle size={10} /> {days}일째 정체
                                    </span>
                                  )}
                                </div>
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
