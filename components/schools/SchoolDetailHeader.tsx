"use client";

import { Phone, Mail, MessageSquare, MapPin, FileDown } from "lucide-react";
import { SchoolDoc } from "@/types";
import { StatusBadge, GradeBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { toTel, toSms, toMailto, toGoogleMaps } from "@/lib/utils";
import { Select } from "@/components/ui/Input";
import { updateSchoolStatus } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { SchoolStatus } from "@/types";

const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료", "보류", "실패"];

export function SchoolDetailHeader({ school }: { school: SchoolDoc }) {
  const { firebaseUser, userDoc } = useAuth();

  async function onStatusChange(status: SchoolStatus) {
    if (!firebaseUser) return;
    await updateSchoolStatus(school.id, status, firebaseUser.uid, userDoc?.name ?? "");
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <GradeBadge grade={school.grade} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink-900">{school.name}</h2>
              <StatusBadge status={school.status} />
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {school.region} · {school.level} · 학생 {school.studentCount ?? 0}명 · 담당 {school.ownerName ?? "-"}
            </p>
            <p className="text-sm text-ink-500">{school.address}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={school.status}
            onChange={(e) => onStatusChange(e.target.value as SchoolStatus)}
            className="w-36"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-border pt-4">
        <a href={toTel(school.phone)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <Phone size={14} /> 전화걸기
          </button>
        </a>
        <a href={toMailto(school.email)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <Mail size={14} /> 이메일 보내기
          </button>
        </a>
        <a href={toSms(school.phone)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <MessageSquare size={14} /> 문자 보내기
          </button>
        </a>
        <a href={toGoogleMaps(school.address)} target="_blank" rel="noreferrer">
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <MapPin size={14} /> 구글지도 열기
          </button>
        </a>
        <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
          <FileDown size={14} /> 브로슈어 다운로드
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
          <FileDown size={14} /> 제안서 다운로드
        </button>
      </div>
    </Card>
  );
}
