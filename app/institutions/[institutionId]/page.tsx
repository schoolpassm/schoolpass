"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { orderBy, limit } from "firebase/firestore";
import { Phone, Mail, MessageSquare, Pencil, UserPlus, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { GradeBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { useFirestoreDoc } from "@/lib/hooks/useDocument";
import { useCollection } from "@/lib/hooks/useCollection";
import { useAuth } from "@/lib/auth-context";
import { InstitutionDoc, PublicPipelineStage, SALES_PRODUCT_LABELS, UnifiedPipelineStage, AccessLogDoc } from "@/types";
import { updateInstitutionPublicStage, updateInstitutionSalesStage, addInstitutionActivity } from "@/lib/api/institutions";
import { InstitutionFormModal } from "@/components/institutions/InstitutionFormModal";
import { InstitutionAiToolsPanel } from "@/components/institutions/InstitutionAiToolsPanel";
import { InstitutionHierarchyPanel } from "@/components/institutions/InstitutionHierarchyPanel";
import { RecommendedSchoolsPanel } from "@/components/institutions/RecommendedSchoolsPanel";
import { InstitutionContactsPanel } from "@/components/institutions/InstitutionContactsPanel";
import { InstitutionDocumentsPanel } from "@/components/institutions/InstitutionDocumentsPanel";
import { QuotesTab } from "@/components/schools/QuotesTab";
import { FilesTab } from "@/components/schools/FilesTab";
import { Tabs } from "@/components/ui/Tabs";
import { toTel, toSms, toMailto, formatDate } from "@/lib/utils";
import { ALL_PUBLIC_STAGES, getPublicStage, getDaysInStage, isStalled } from "@/lib/public-pipeline";
import { ALL_UNIFIED_STAGES, getSalesStage, getDaysInSalesStage, isSalesStalled } from "@/lib/unified-pipeline";
import { logAccess } from "@/lib/api/access-log";

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
  const { firebaseUser, userDoc, isAdmin } = useAuth();
  const { data: institution } = useFirestoreDoc<InstitutionDoc>("institutions", institutionId);
  const { data: activities } = useCollection<any>(`institutions/${institutionId}/activities`, [orderBy("createdAt", "desc")]);
  // bounded read — 기존 대시보드 집계 쿼리와 동일한 "읽기 비용 최소화" 원칙으로 최근 20건만
  const { data: accessLogs } = useCollection<AccessLogDoc>(`institutions/${institutionId}/access_logs`, [
    orderBy("createdAt", "desc"),
    limit(20),
  ]);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!institution || !firebaseUser) return;
    logAccess("institutions", institutionId, "view", firebaseUser.uid, userDoc?.name ?? "", {
      targetName: institution.name,
    });
    // institution이 처음 로드됐을 때 1회만 — institution 전체 객체가 매 렌더 바뀌므로 id 기준으로만 추적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, firebaseUser]);

  if (!institution) {
    return (
      <AppShell title="관공서 상세">
        <p className="text-sm text-ink-400">불러오는 중...</p>
      </AppShell>
    );
  }

  async function onStageChange(stage: PublicPipelineStage) {
    await updateInstitutionPublicStage(institutionId, stage);
  }

  async function onSalesStageChange(stage: UnifiedPipelineStage) {
    await updateInstitutionSalesStage(institutionId, stage);
    if (firebaseUser) {
      await logAccess("institutions", institutionId, "update", firebaseUser.uid, userDoc?.name ?? "", {
        targetName: institution?.name ?? "",
        changedFields: ["salesStage"],
      });
    }
  }

  async function handleLogNote() {
    if (!firebaseUser || !note.trim()) return;
    await addInstitutionActivity(institutionId, {
      type: "etc",
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
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                  {getPublicStage(institution)}
                </span>
                {isStalled(institution) && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <AlertTriangle size={12} /> {getDaysInStage(institution)}일째 정체
                  </span>
                )}
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
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-ink-400">공공영업 단계</span>
              <Select value={getPublicStage(institution)} onChange={(e) => onStageChange(e.target.value as PublicPipelineStage)} className="w-40">
                {ALL_PUBLIC_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-ink-400">통합 영업 단계 (ZeroPass)</span>
              <Select value={getSalesStage(institution)} onChange={(e) => onSalesStageChange(e.target.value as UnifiedPipelineStage)} className="w-44">
                {ALL_UNIFIED_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {isSalesStalled(institution) && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            <AlertTriangle size={12} /> 통합 영업 단계 {getDaysInSalesStage(institution)}일째 정체 (후속 연락 필요)
          </div>
        )}

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

      {/* ZeroPass 통합 확장(2026.10 지시서 2·5번) — 제품 구분 및 도입 현황 CRM 상세 항목.
          값이 없는 필드는 "검토 필요"로 표시해, 확정된 값처럼 보이지 않게 한다(지시서 7번). */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>제품 및 도입 현황</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">제품</p>
              <p className="text-sm font-bold text-ink-900">
                {institution.product ? (
                  SALES_PRODUCT_LABELS[institution.product]
                ) : (
                  <span className="text-amber-600">검토 필요</span>
                )}
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">현재 방문자 관리 방식</p>
              <p className="text-sm font-bold text-ink-900">{institution.visitorManagementMethod ?? "미확인"}</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">구매·계약 방식</p>
              <p className="text-sm font-bold text-ink-900">{institution.purchaseMethod ?? "미확인"}</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">정보보안 검토 상태</p>
              <p className="text-sm font-bold text-ink-900">
                {institution.securityReviewStatus ?? <span className="text-amber-600">검토 필요</span>}
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">개인정보 처리 검토 상태</p>
              <p className="text-sm font-bold text-ink-900">
                {institution.privacyReviewStatus ?? <span className="text-amber-600">검토 필요</span>}
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-[11px] text-ink-500">시범 운영 필요 여부</p>
              <p className="text-sm font-bold text-ink-900">{institution.pilotRunNeeded ? "필요" : "불필요/미확인"}</p>
            </div>
            {institution.operationalPainPoints && (
              <div className="col-span-2 rounded-lg bg-surface-muted p-3 sm:col-span-3">
                <p className="text-[11px] text-ink-500">현재 운영상 불편</p>
                <p className="text-sm text-ink-800">{institution.operationalPainPoints}</p>
              </div>
            )}
            {institution.adoptionPriority && (
              <div className="col-span-2 rounded-lg bg-surface-muted p-3 sm:col-span-3">
                <p className="text-[11px] text-ink-500">도입 필요성 및 우선순위</p>
                <p className="text-sm text-ink-800">{institution.adoptionPriority}</p>
              </div>
            )}
            {institution.nextAction && (
              <div className="col-span-2 rounded-lg bg-primary-50 p-3 sm:col-span-3">
                <p className="text-[11px] text-primary-600">다음 행동</p>
                <p className="text-sm font-medium text-primary-800">{institution.nextAction}</p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <InstitutionHierarchyPanel institution={institution} />

      <RecommendedSchoolsPanel institution={institution} />

      <div className="mt-4">
        <InstitutionAiToolsPanel institutionId={institutionId} />
      </div>

      <InstitutionContactsPanel institutionId={institutionId} />

      <InstitutionDocumentsPanel institutionId={institutionId} />

      <Card className="mt-4">
        <CardBody>
          <Tabs
            tabs={[
              {
                key: "activity",
                label: "활동 기록 (통화·방문·이메일·시연)",
                content: (
                  <div>
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
                  </div>
                ),
              },
              {
                key: "quotes",
                label: "견적",
                content: <QuotesTab basePath={`institutions/${institutionId}`} />,
              },
              {
                key: "files",
                label: "첨부파일 (제안서·소개서·시연자료·계약서)",
                content: (
                  <FilesTab
                    basePath={`institutions/${institutionId}`}
                    storagePrefix={`institutions/${institutionId}`}
                    categories={["brochure", "proposal", "demo_material", "contract", "photo", "etc"]}
                  />
                ),
              },
              {
                key: "note",
                label: "메모",
                content: <p className="whitespace-pre-wrap text-sm text-ink-700">{institution.note || "메모가 없습니다."}</p>,
              },
            ]}
          />
        </CardBody>
      </Card>

      {/* 지시서 7번 "고객 정보 열람·수정 이력" — admin에게만 노출(일반 영업담당에게는 불필요한 정보) */}
      {isAdmin && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>열람·수정 이력 (관리자 전용, 최근 20건)</CardTitle>
          </CardHeader>
          <CardBody>
            {accessLogs.length === 0 && <p className="text-xs text-ink-300">기록된 열람·수정 이력이 없습니다.</p>}
            <ul className="space-y-1.5">
              {accessLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between text-xs text-ink-500">
                  <span>
                    <span className="font-medium text-ink-700">{log.actorName || "알 수 없음"}</span>
                    {" · "}
                    {log.action === "view" ? "열람" : log.action === "update" ? "수정" : "내보내기"}
                    {log.changedFields && log.changedFields.length > 0 && ` (${log.changedFields.join(", ")})`}
                  </span>
                  <span>{formatDate(log.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </AppShell>
  );
}
