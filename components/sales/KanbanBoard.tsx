"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import Link from "next/link";
import { limit, orderBy, where } from "firebase/firestore";
import { ArrowDownWideNarrow, Sparkles, Users } from "lucide-react";
import { PIPELINE_STAGES, SchoolSummaryDoc, SchoolStatus, UserDoc } from "@/types";
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
const UNASSIGNED = "__unassigned__";

type SortMode = "updatedAt" | "aiScore";

export function KanbanBoard() {
  const { firebaseUser, userDoc } = useAuth();
  const [sortMode, setSortMode] = useState<SortMode>("updatedAt");
  const [ownerFilter, setOwnerFilter] = useState<string>(""); // "" = 전체, UNASSIGNED = 담당자 없음, 그 외 = 이름
  const { data: teamMembers } = useCollection<UserDoc>("users");

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    if (!firebaseUser) return;
    await updateSchoolStatus(draggableId, destination.droppableId as SchoolStatus, firebaseUser.uid, userDoc?.name ?? "");
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">정렬 기준:</span>
        <button
          onClick={() => setSortMode("updatedAt")}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
            sortMode === "updatedAt" ? "bg-primary-500 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface-border"
          )}
        >
          <ArrowDownWideNarrow size={12} /> 최근 업데이트순
        </button>
        <button
          onClick={() => setSortMode("aiScore")}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium",
            sortMode === "aiScore" ? "bg-primary-500 text-white" : "bg-surface-muted text-ink-500 hover:bg-surface-border"
          )}
        >
          <Sparkles size={12} /> 계약가능성(AI 점수)순
        </button>
        {sortMode === "aiScore" && (
          <span className="text-[11px] text-amber-600">※ AI 점수를 아직 안 매긴 학교는 이 정렬에서 안 보입니다</span>
        )}

        <span className="ml-2 flex items-center gap-1 text-xs text-ink-500">
          <Users size={12} /> 담당자:
        </span>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="h-8 rounded-md border border-surface-border bg-white px-2 text-xs"
        >
          <option value="">전체 팀원</option>
          {teamMembers
            .filter((m) => m.name)
            .map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          <option value={UNASSIGNED}>담당자 미배정</option>
        </select>
        {ownerFilter && (
          <span className="text-[11px] text-primary-600">
            "{ownerFilter === UNASSIGNED ? "담당자 미배정" : ownerFilter}" 담당 학교만 표시 중 — 다른 팀원이 이미 진행 중인 곳은 안 보입니다
          </span>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn key={`${stage}-${sortMode}`} stage={stage} sortMode={sortMode} ownerFilter={ownerFilter} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function KanbanColumn({ stage, sortMode, ownerFilter }: { stage: SchoolStatus; sortMode: SortMode; ownerFilter: string }) {
  // 각 컬럼이 독립적으로 실시간 구독 — status 필터 + limit(100)으로 bounded read 유지
  // 담당자 필터는 이미 불러온 100건 안에서 클라이언트단으로 걸러낸다 (별도 쿼리/인덱스 불필요)
  const { data: rawSchools, loading, error } = useCollection<SchoolSummaryDoc>("schools_summary", [
    where("status", "==", stage),
    orderBy(sortMode, "desc"),
    limit(COLUMN_LIMIT),
  ]);

  const schools = ownerFilter
    ? rawSchools.filter((s) => (ownerFilter === UNASSIGNED ? !s.ownerName : s.ownerName === ownerFilter))
    : rawSchools;

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
          {error && (
            <p className="mx-2 mt-2 rounded-md bg-red-50 p-2 text-[10px] text-status-danger">
              불러오기 오류: {error.message.slice(0, 120)}
              {error.message.includes("indexes?create_composite") && " (콘솔 F12 에러 메시지의 링크를 클릭하면 인덱스가 자동 생성됩니다)"}
            </p>
          )}
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
                    <p className="mt-1">
                      {s.ownerName ? (
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                          담당 {s.ownerName}
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
            ))}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}
