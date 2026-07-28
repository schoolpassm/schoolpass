import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SchoolSummaryDoc } from "@/types";
import { GradeBadge } from "@/components/ui/Badge";

export function TopSchoolsList({
  title,
  schools,
  emptyHint,
  showScore = true,
}: {
  title: string;
  schools: SchoolSummaryDoc[];
  emptyHint: string;
  showScore?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {schools.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-ink-300">{emptyHint}</p>
        ) : (
          <ul className="divide-y divide-surface-border max-h-80 overflow-y-auto">
            {schools.map((s, i) => (
              <li key={s.id}>
                <Link href={`/schools/${s.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted">
                  <span className="w-5 text-center text-xs font-bold text-ink-300">{i + 1}</span>
                  <GradeBadge grade={s.grade} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{s.name}</p>
                    <p className="truncate text-xs text-ink-500">{s.region} · {s.ownerName ?? "담당자 미지정"}</p>
                  </div>
                  {showScore && s.aiScore != null && (
                    <span className="shrink-0 rounded-full bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-600">
                      {s.aiScore}점
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
