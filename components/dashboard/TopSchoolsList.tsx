import Link from "next/link";
import { Phone, Mail, MessageSquare } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SchoolSummaryDoc } from "@/types";
import { GradeBadge } from "@/components/ui/Badge";
import { toTel, toSms, toMailto } from "@/lib/utils";

export function TopSchoolsList({
  title,
  schools,
  emptyHint,
  showScore = true,
  showActions = false,
}: {
  title: string;
  schools: SchoolSummaryDoc[];
  emptyHint: string;
  showScore?: boolean;
  showActions?: boolean;
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
                  {showActions && (
                    <div className="flex shrink-0 items-center gap-1 text-ink-400" onClick={(e) => e.stopPropagation()}>
                      <a href={toTel(s.phone)} title="전화걸기" className="rounded p-1 hover:bg-primary-50 hover:text-primary-600">
                        <Phone size={13} />
                      </a>
                      <a href={toSms(s.phone)} title="문자보내기" className="rounded p-1 hover:bg-primary-50 hover:text-primary-600">
                        <MessageSquare size={13} />
                      </a>
                      <a href={toMailto(s.email)} title="이메일" className="rounded p-1 hover:bg-primary-50 hover:text-primary-600">
                        <Mail size={13} />
                      </a>
                    </div>
                  )}
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
