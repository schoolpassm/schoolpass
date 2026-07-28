import { cn } from "@/lib/utils";
import { SchoolGrade, SchoolStatus } from "@/types";

const STATUS_STYLE: Record<SchoolStatus, string> = {
  신규: "bg-gray-100 text-gray-600",
  전화완료: "bg-primary-50 text-primary-600",
  자료발송: "bg-violet-50 text-violet-600",
  방문예정: "bg-amber-50 text-amber-600",
  시연: "bg-sky-50 text-sky-600",
  견적: "bg-orange-50 text-orange-600",
  협의중: "bg-yellow-50 text-yellow-700",
  계약: "bg-emerald-50 text-emerald-600",
  설치완료: "bg-green-100 text-green-700",
  보류: "bg-gray-200 text-gray-500",
  실패: "bg-red-50 text-red-500",
};

export function StatusBadge({ status }: { status: SchoolStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status]
      )}
    >
      {status}
    </span>
  );
}

const GRADE_STYLE: Record<SchoolGrade, string> = {
  A: "bg-primary-600 text-white",
  B: "bg-primary-300 text-primary-900",
  C: "bg-amber-200 text-amber-900",
  D: "bg-gray-200 text-gray-600",
};

export function GradeBadge({ grade }: { grade: SchoolGrade }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
        GRADE_STYLE[grade]
      )}
    >
      {grade}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-xs text-ink-500 border border-surface-border">
      {children}
    </span>
  );
}
