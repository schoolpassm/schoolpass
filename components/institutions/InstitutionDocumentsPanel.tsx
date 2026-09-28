"use client";

import { useState } from "react";
import { orderBy, Timestamp } from "firebase/firestore";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCollection } from "@/lib/hooks/useCollection";
import { useAuth } from "@/lib/auth-context";
import { addInstitutionDocument } from "@/lib/api/institutions";
import { InstitutionDocumentDoc } from "@/types";
import { formatDate } from "@/lib/utils";

/**
 * 정책·공문 CRM 패널 (스펙 6번). 관련 법령/정책/공문을 기관별로 연결해 기록한다.
 * AI는 이 기록을 근거로만 답할 뿐, 법률적 판단을 확정적으로 내리지 않는다는 원칙을 화면에도 남겨둔다.
 */
export function InstitutionDocumentsPanel({ institutionId }: { institutionId: string }) {
  const { firebaseUser } = useAuth();
  const { data: documents } = useCollection<InstitutionDocumentDoc>(`institutions/${institutionId}/documents`, [
    orderBy("createdAt", "desc"),
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    relatedLaw: "",
    relatedPolicy: "",
    docTitle: "",
    issuingOrg: "",
    docDate: "",
    relatedLink: "",
    institutionResponded: false,
    contactReply: "",
    followUp: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await addInstitutionDocument(
        institutionId,
        {
          ...form,
          docDate: form.docDate ? Timestamp.fromDate(new Date(form.docDate)) : null,
        },
        firebaseUser.uid
      );
      setForm({
        relatedLaw: "",
        relatedPolicy: "",
        docTitle: "",
        issuingOrg: "",
        docDate: "",
        relatedLink: "",
        institutionResponded: false,
        contactReply: "",
        followUp: "",
      });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>정책·공문 기록 ({documents.length}건)</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 기록 추가
        </Button>
      </CardHeader>
      <CardBody>
        {documents.length === 0 && <p className="text-xs text-ink-300">등록된 정책·공문 기록이 없습니다.</p>}
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="rounded-lg bg-surface-muted p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                  <FileText size={14} className="text-ink-400" />
                  {d.docTitle || "제목 미입력"}
                </p>
                <span className="text-xs text-ink-400">{d.docDate ? formatDate(d.docDate) : ""}</span>
              </div>
              {(d.relatedLaw || d.relatedPolicy) && (
                <p className="text-xs text-ink-500">
                  {d.relatedLaw && `관련 법령: ${d.relatedLaw}`}
                  {d.relatedLaw && d.relatedPolicy && " · "}
                  {d.relatedPolicy && `관련 정책: ${d.relatedPolicy}`}
                </p>
              )}
              {d.issuingOrg && <p className="text-xs text-ink-500">발행기관: {d.issuingOrg}</p>}
              {d.relatedLink && (
                <a
                  href={d.relatedLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 text-xs text-primary-600 hover:underline"
                >
                  <ExternalLink size={12} /> 관련 링크
                </a>
              )}
              <p className="mt-1 text-xs">
                기관 대응 여부:{" "}
                <span className={d.institutionResponded ? "text-status-done" : "text-ink-400"}>
                  {d.institutionResponded ? "대응함" : "미대응"}
                </span>
              </p>
              {d.contactReply && <p className="mt-1 text-xs text-ink-700">담당자 답변: {d.contactReply}</p>}
              {d.followUp && <p className="text-xs text-ink-700">후속조치: {d.followUp}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-300">
          ※ 여기 기록된 법령·정책은 참고용 CRM 데이터이며, AI 답변은 이 기록에 근거할 뿐 법률적 판단을 확정적으로 내리지
          않습니다.
        </p>
      </CardBody>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="정책·공문 기록 추가">
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="공문 제목">
            <Input value={form.docTitle} onChange={(e) => set("docTitle", e.target.value)} className="sm:col-span-2" />
          </Field>
          <Field label="관련 법령">
            <Input placeholder="예: 청사출입보안지침" value={form.relatedLaw} onChange={(e) => set("relatedLaw", e.target.value)} />
          </Field>
          <Field label="관련 정책">
            <Input value={form.relatedPolicy} onChange={(e) => set("relatedPolicy", e.target.value)} />
          </Field>
          <Field label="공문 발행기관">
            <Input value={form.issuingOrg} onChange={(e) => set("issuingOrg", e.target.value)} />
          </Field>
          <Field label="공문 날짜">
            <Input type="date" value={form.docDate} onChange={(e) => set("docDate", e.target.value)} />
          </Field>
          <Field label="관련 링크">
            <Input placeholder="https://..." value={form.relatedLink} onChange={(e) => set("relatedLink", e.target.value)} className="sm:col-span-2" />
          </Field>
          <label className="flex items-center gap-1.5 text-xs text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.institutionResponded}
              onChange={(e) => set("institutionResponded", e.target.checked)}
            />
            기관이 대응함
          </label>
          <Field label="담당자 답변">
            <Input value={form.contactReply} onChange={(e) => set("contactReply", e.target.value)} className="sm:col-span-2" />
          </Field>
          <Field label="후속조치">
            <Input value={form.followUp} onChange={(e) => set("followUp", e.target.value)} className="sm:col-span-2" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "저장 중..." : "추가"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
