"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { Phone, Mail, MessageSquare, Pencil, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, GradeBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { useFirestoreDoc } from "@/lib/hooks/useDocument";
import { useCollection } from "@/lib/hooks/useCollection";
import { useAuth } from "@/lib/auth-context";
import { InstitutionDoc, SchoolStatus } from "@/types";
import { updateInstitutionStatus, addInstitutionActivity } from "@/lib/api/institutions";
import { InstitutionFormModal } from "@/components/institutions/InstitutionFormModal";
import { InstitutionAiToolsPanel } from "@/components/institutions/InstitutionAiToolsPanel";
import { toTel, toSms, toMailto, formatDate } from "@/lib/utils";

const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료", "보류", "실패"];

const ACTIVITY_LABEL: Record<string, string> = { call: "전화", email: "이메일", sms: "문자", visit: "방문", note: "메모" };

function downloadContactVCard(institution: InstitutionDoc) {
  const displayName = `${institution.name} ${institution.contactName ?? "담당자"}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${displayName}`,
    `ORG:${institution.name}`,
    institution.contactTitle ? `TITLE:${institution.contactTitle}` : "",
    institution.contactPhone ? `TEL;TYPE=CELL:${institution.contactPhone}` : "",
    institution.contactEmail ? `EMAIL:${institution.contactEmail}` : "",
    "END:VCARD",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\n")], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${institution.name}_${institution.contactName ?? "담당자"}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InstitutionDetailPage() {
  const params = useParams();
  const institutionId = params.institutionId as string;
  const { firebaseUser, userDoc } = useAuth();
  const { data: institution } = useFirestoreDoc<InstitutionDoc>("institutions", institutionId);
  const { data: activities } = useCollection<any>(`institutions/${institutionId}/activities`, [orderBy("createdAt", "desc")]);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!institution) {
    return (
      <AppShell title="관공서 상세">
        <p className="text-sm text-ink-400">불러오는 중...</p>
      </AppShell>
    );
  }

  async function onStatusChange(status: SchoolStatus) {
    await updateInstitutionStatus(institutionId, status);
  }

  async function handleLogNote() {
    if (!firebaseUser || !note.trim()) return;
    await addInstitutionActivity(institutionId, {
      type: "note",
      summary: note.trim(),
      authorUid: firebaseUser.uid,
      authorName: userDoc?.name ?? "",
    });
    setNote("");
  }

  const callTarget = institution.contactPhone || institution.phone;

  return (
    <AppShell title={institution.name}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <GradeBadge grade={institution.grade} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink-900">{institution.name}</h2>
                <StatusBadge status={institution.status} />
              </div>
              <p className="mt-1 text-sm text-ink-500">
                {institution.type} · {institution.region} · 영업담당 {institution.ownerName ?? "-"}
              </p>
              <p className="text-sm text-ink-500">{institution.address}</p>
              {(institution.contactName || institution.contactPhone || institution.contactEmail) && (
                <p className="mt-1 text-sm font-medium text-ink-700">
                  담당자: {institution.contactName ?? "성함 미입력"}
                  {institution.contactTitle && ` (${institution.contactTitle})`}
                  {institution.contactPhone && ` · ${institution.contactPhone}`}
                  {institution.contactEmail && ` · ${institution.contactEmail}`}
                </p>
              )}
              {institution.department && <p className="text-xs text-ink-400">담당부서: {institution.department}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> 정보 수정
            </Button>
            <Select value={institution.status} onChange={(e) => onStatusChange(e.target.value as SchoolStatus)} className="w-36">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>

        {(institution.budgetStatus || institution.nextContactDueAt || institution.expectedAdoptionPeriod || institution.interestLevel) && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
            {institution.interestLevel && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-[11px] text-ink-500">관심도</p>
                <p className="text-sm font-bold text-ink-900">{institution.interestLevel}</p>
              </div>
            )}
            {institution.budgetStatus && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-[11px] text-ink-500">예산 상태</p>
                <p className="text-sm font-bold text-ink-900">{institution.budgetStatus}</p>
              </div>
            )}
            {institution.nextContactDueAt && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-[11px] text-ink-500">다음 접촉 예정일</p>
                <p className="text-sm font-bold text-ink-900">{formatDate(institution.nextContactDueAt)}</p>
              </div>
            )}
            {institution.expectedAdoptionPeriod && (
              <div className="rounded-lg bg-surface-muted p-3">
                <p className="text-[11px] text-ink-500">예상 도입 시기</p>
                <p className="text-sm font-bold text-ink-900">{institution.expectedAdoptionPeriod}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-border pt-4">
          <a href={toTel(callTarget)}>
            <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
              <Phone size={14} /> 전화걸기{institution.contactPhone && " (담당자)"}
            </button>
          </a>
          <a href={toMailto(institution.contactEmail)}>
            <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
              <Mail size={14} /> 이메일 보내기
            </button>
          </a>
          <a href={toSms(callTarget)}>
            <button className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted">
              <MessageSquare size={14} /> 문자 보내기
            </button>
          </a>
          {(institution.contactPhone || institution.contactEmail) && (
            <button
              onClick={() => downloadContactVCard(institution)}
              className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 hover:bg-primary-100"
            >
              <UserPlus size={14} /> 연락처 저장 (휴대폰용)
            </button>
          )}
        </div>

        <InstitutionFormModal open={editOpen} onClose={() => setEditOpen(false)} institution={institution} />
      </Card>

      <div className="mt-4">
        <InstitutionAiToolsPanel institutionId={institutionId} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>활동 기록</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="mb-3 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="통화/방문 내용 메모..."
              className="h-9 flex-1 rounded-md border border-surface-border px-3 text-sm"
            />
            <Button size="sm" onClick={handleLogNote} disabled={!note.trim()}>
              기록
            </Button>
          </div>
          {activities.length === 0 && <p className="text-xs text-ink-300">아직 활동 기록이 없습니다.</p>}
          <ul className="space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="rounded-lg bg-surface-muted p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">[{ACTIVITY_LABEL[a.type] ?? a.type}]</span>
                  <span>
                    {a.authorName} · {formatDate(a.createdAt, true)}
                  </span>
                </div>
                <p className="text-ink-800">{a.summary}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </AppShell>
  );
}
