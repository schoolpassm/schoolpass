import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PIPELINE_STAGES } from "@/types";
import { cn } from "@/lib/utils";

export function PipelineOverview({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...PIPELINE_STAGES.map((s) => counts[s] ?? 0));
  return (
    <Card>
      <CardHeader>
        <CardTitle>영업 파이프라인</CardTitle>
        <Link href="/sales" className="text-xs font-medium text-primary-600 hover:underline">
          칸반보드 열기 →
        </Link>
      </CardHeader>
      <CardBody className="flex gap-3 overflow-x-auto">
        {PIPELINE_STAGES.map((stage) => {
          const value = counts[stage] ?? 0;
          const height = Math.max(6, (value / max) * 96);
          return (
            <div key={stage} className="flex min-w-[64px] flex-1 flex-col items-center gap-2">
              <span className="text-sm font-bold text-ink-900">{value}</span>
              <div className="flex h-24 w-full items-end rounded-md bg-surface-muted">
                <div
                  className={cn("w-full rounded-md bg-primary-500 transition-all")}
                  style={{ height }}
                />
              </div>
              <span className="text-center text-[11px] leading-tight text-ink-500">{stage}</span>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
