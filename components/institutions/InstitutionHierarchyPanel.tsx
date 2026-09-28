"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { getChildInstitutions, getInstitutionsByIds } from "@/lib/api/institutions";
import { InstitutionDoc } from "@/types";

/**
 * 기관 상세페이지의 계층 구조 패널.
 * - 위쪽: 상위기관 브레드크럼 (교육부 → 교육청 → 교육지원청 순서로, ancestorPath 기반)
 * - 아래쪽: 직속 하위기관 목록 (parentInstitutionId로 이 기관을 가리키는 기관들)
 * 계층이 전혀 없는 기관(최상위 단일 기관, ZeroPass 관공서 대부분)에서는 아무것도 렌더링하지 않는다.
 */
export function InstitutionHierarchyPanel({ institution }: { institution: InstitutionDoc }) {
  const [ancestors, setAncestors] = useState<InstitutionDoc[]>([]);
  const [children, setChildren] = useState<InstitutionDoc[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = institution.ancestorPath ?? [];
      if (path.length === 0) {
        if (!cancelled) setAncestors([]);
        return;
      }
      const docs = await getInstitutionsByIds(path);
      if (!cancelled) setAncestors(docs);
    })();
    return () => {
      cancelled = true;
    };
  }, [institution.ancestorPath?.join(",")]);

  useEffect(() => {
    let cancelled = false;
    setLoadingChildren(true);
    getChildInstitutions(institution.id).then((docs) => {
      if (!cancelled) {
        setChildren(docs);
        setLoadingChildren(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [institution.id]);

  const hasAncestors = ancestors.length > 0;
  const hasChildren = loadingChildren || children.length > 0;

  if (!hasAncestors && !hasChildren) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>기관 계층</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {hasAncestors && (
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <Link href={`/institutions/${a.id}`} className="text-primary-600 hover:underline">
                  {a.name}
                </Link>
                <ChevronRight size={14} className="text-ink-300" />
              </span>
            ))}
            <span className="font-semibold text-ink-900">{institution.name}</span>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-500">
            하위기관 {institution.childCount ? `(${institution.childCount}곳)` : ""}
          </p>
          {loadingChildren && <p className="text-xs text-ink-300">불러오는 중...</p>}
          {!loadingChildren && children.length === 0 && (
            <p className="text-xs text-ink-300">등록된 하위기관이 없습니다.</p>
          )}
          {!loadingChildren && children.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {children.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/institutions/${c.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-muted"
                  >
                    <span className="flex items-center gap-1.5 text-ink-800">
                      <Building2 size={14} className="text-ink-400" />
                      {c.name}
                    </span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
