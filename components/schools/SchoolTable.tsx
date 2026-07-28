"use client";

import Link from "next/link";
import { Phone, Mail, MapPin, MessageSquare } from "lucide-react";
import { SchoolDoc } from "@/types";
import { StatusBadge, GradeBadge, Tag } from "@/components/ui/Badge";
import { toTel, toSms, toMailto, toGoogleMaps } from "@/lib/utils";

export function SchoolTable({
  schools,
  selectedIds,
  onToggleSelect,
}: {
  schools: SchoolDoc[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-white shadow-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface-muted text-left text-xs text-ink-500">
            {onToggleSelect && <th className="w-8 px-4 py-3"></th>}
            <th className="px-4 py-3 font-medium">등급</th>
            <th className="px-4 py-3 font-medium">학교명</th>
            <th className="px-4 py-3 font-medium">지역</th>
            <th className="px-4 py-3 font-medium">학교급</th>
            <th className="px-4 py-3 font-medium">담당자</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">태그</th>
            <th className="px-4 py-3 font-medium">빠른 액션</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.id} className="border-b border-surface-border last:border-0 hover:bg-surface-muted/60">
              {onToggleSelect && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(s.id) ?? false}
                    onChange={() => onToggleSelect(s.id)}
                    className="h-4 w-4 rounded border-surface-border accent-primary-500"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <GradeBadge grade={s.grade} />
              </td>
              <td className="px-4 py-3">
                <Link href={`/schools/${s.id}`} className="font-medium text-ink-900 hover:text-primary-600">
                  {s.name}
                </Link>
                {s.isNewlyOpened && (
                  <span className="ml-1.5 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-600">
                    신설
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-ink-500">{s.region}</td>
              <td className="px-4 py-3 text-ink-500">{s.level}</td>
              <td className="px-4 py-3 text-ink-500">{s.ownerName ?? "-"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {(s.tags ?? []).slice(0, 2).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-ink-400">
                  <a href={toTel(s.phone)} className="rounded p-1.5 hover:bg-primary-50 hover:text-primary-600" title="전화걸기">
                    <Phone size={14} />
                  </a>
                  <a href={toSms(s.phone)} className="rounded p-1.5 hover:bg-primary-50 hover:text-primary-600" title="문자보내기">
                    <MessageSquare size={14} />
                  </a>
                  <a href={toMailto(s.email)} className="rounded p-1.5 hover:bg-primary-50 hover:text-primary-600" title="이메일">
                    <Mail size={14} />
                  </a>
                  <a
                    href={toGoogleMaps(s.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1.5 hover:bg-primary-50 hover:text-primary-600"
                    title="구글지도"
                  >
                    <MapPin size={14} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
          {schools.length === 0 && (
            <tr>
              <td colSpan={onToggleSelect ? 9 : 8} className="px-4 py-16 text-center text-sm text-ink-300">
                등록된 학교가 없습니다. 우측 상단의 &apos;학교 등록&apos; 버튼으로 추가하세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
