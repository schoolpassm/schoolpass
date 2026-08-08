"use client";

import { useState } from "react";
import { Phone, Mail, MessageSquare, MapPin, FileDown, UserPlus, Pencil } from "lucide-react";
import { SchoolDoc } from "@/types";
import { StatusBadge, GradeBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toTel, toSms, toMailto, toGoogleMaps } from "@/lib/utils";
import { Select } from "@/components/ui/Input";
import { updateSchoolStatus } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { SchoolStatus } from "@/types";
import { SchoolFormModal } from "@/components/schools/SchoolFormModal";

const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료", "보류", "실패"];

/** 담당자 연락처를 vCard(.vcf) 파일로 만들어 다운로드한다 — 휴대폰에서 열면 바로 연락처 저장됨.
 * 이름을 "학교명 담당자님"으로 저장해서, 다음에 전화 왔을 때 어느 학교인지 바로 알아볼 수 있게 한다. */
function downloadContactVCard(school: SchoolDoc) {
  const displayName = `${school.name} ${school.contactName ?? "담당자"}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${displayName}`,
    `ORG:${school.name}`,
    school.contactTitle ? `TITLE:${school.contactTitle}` : "",
    school.contactPhone ? `TEL;TYPE=CELL:${school.contactPhone}` : "",
    school.contactEmail ? `EMAIL:${school.contactEmail}` : "",
    "END:VCARD",
  ].filter(Boolean);

  const blob = new Blob([lines.join("\n")], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${school.name}_${school.contactName ?? "담당자"}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SchoolDetailHeader({ school }: { school: SchoolDoc }) {
  const { firebaseUser, userDoc } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  async function onStatusChange(status: SchoolStatus) {
    if (!firebaseUser) return;
    await updateSchoolStatus(school.id, status, firebaseUser.uid, userDoc?.name ?? "");
  }

  // 담당자 개인 연락처가 있으면 그걸 우선 사용, 없으면 학교 대표 전화/이메일로 대체
  const callTarget = school.contactPhone || school.phone;
  const emailTarget = school.contactEmail || school.email;
  const smsTarget = school.contactPhone || school.phone;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <GradeBadge grade={school.grade} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink-900">{school.name}</h2>
              <StatusBadge status={school.status} />
              {school.isClosed && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-status-danger">
                  폐교
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {school.region} · {school.level}
              {school.foundationType && ` · ${school.foundationType}`}
              {" · "}학생 {school.studentCount ?? 0}명 · 영업담당 {school.ownerName ?? "-"}
              {school.aiScore != null && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-600">
                  AI 계약가능성 {school.aiScore}점
                </span>
              )}
            </p>
            <p className="text-sm text-ink-500">{school.address}</p>
            {(school.contactName || school.contactPhone || school.contactEmail) && (
              <p className="mt-1 text-sm font-medium text-ink-700">
                학교 담당자: {school.contactName ?? "성함 미입력"}
                {school.contactTitle && ` (${school.contactTitle})`}
                {school.contactPhone && ` · ${school.contactPhone}`}
                {school.contactEmail && ` · ${school.contactEmail}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={14} /> 정보 수정
          </Button>
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
        <a href={toTel(callTarget)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <Phone size={14} /> 전화걸기{school.contactPhone && " (담당자)"}
          </button>
        </a>
        <a href={toMailto(emailTarget)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <Mail size={14} /> 이메일 보내기{school.contactEmail && " (담당자)"}
          </button>
        </a>
        <a href={toSms(smsTarget)}>
          <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
            <MessageSquare size={14} /> 문자 보내기
          </button>
        </a>
        {(school.contactPhone || school.contactEmail) && (
          <button
            onClick={() => downloadContactVCard(school)}
            className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
          >
            <UserPlus size={14} /> 연락처 저장 (휴대폰용)
          </button>
        )}
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

      <SchoolFormModal open={editOpen} onClose={() => setEditOpen(false)} school={school} />
    </Card>
  );
}
