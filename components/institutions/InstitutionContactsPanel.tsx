"use client";

import { useState } from "react";
import { orderBy } from "firebase/firestore";
import { Plus, UserX, Phone, Mail } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCollection } from "@/lib/hooks/useCollection";
import { useAuth } from "@/lib/auth-context";
import { addInstitutionContact, deactivateInstitutionContact } from "@/lib/api/institutions";
import { ContactReaction, InstitutionContactDoc, InterestLevel } from "@/types";
import { toTel, toMailto, formatDate } from "@/lib/utils";

const REACTIONS: ContactReaction[] = ["긍정적", "중립", "부정적", "무반응", "미확인"];
const INTEREST_LEVELS: InterestLevel[] = ["높음", "보통", "낮음"];

/**
 * 담당자 다중관리 패널 (스펙 7번).
 * 기관:담당자 = 1:N. 담당자가 바뀌어도 이력을 지우지 않고 active=false로 비활성화만 한다.
 */
export function InstitutionContactsPanel({ institutionId }: { institutionId: string }) {
  const { firebaseUser } = useAuth();
  const { data: contacts } = useCollection<InstitutionContactDoc>(`institutions/${institutionId}/contacts`, [
    orderBy("createdAt", "desc"),
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: "",
    title: "",
    phone: "",
    email: "",
    responsibility: "",
    isFieldContact: false,
    isDecisionMaker: false,
    reaction: "미확인" as ContactReaction,
    interestLevel: "보통" as InterestLevel,
    note: "",
  });

  const activeContacts = contacts.filter((c) => c.active !== false);
  const inactiveContacts = contacts.filter((c) => c.active === false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !form.name.trim()) return;
    setSaving(true);
    try {
      await addInstitutionContact(institutionId, form, firebaseUser.uid);
      setForm({
        name: "",
        department: "",
        title: "",
        phone: "",
        email: "",
        responsibility: "",
        isFieldContact: false,
        isDecisionMaker: false,
        reaction: "미확인",
        interestLevel: "보통",
        note: "",
      });
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>담당자 ({activeContacts.length}명)</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
          <Plus size={14} /> 담당자 추가
        </Button>
      </CardHeader>
      <CardBody>
        {activeContacts.length === 0 && <p className="text-xs text-ink-300">등록된 담당자가 없습니다.</p>}
        <ul className="space-y-2">
          {activeContacts.map((c) => (
            <li key={c.id} className="rounded-lg border border-surface-border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">
                    {c.name}
                    {c.title && <span className="ml-1 font-normal text-ink-500">· {c.title}</span>}
                    {c.isDecisionMaker && (
                      <span className="ml-1.5 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                        의사결정
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    {c.department && `${c.department} · `}
                    {c.responsibility}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-500">
                    {c.phone && (
                      <a href={toTel(c.phone)} className="flex items-center gap-1 hover:text-primary-600">
                        <Phone size={12} /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={toMailto(c.email)} className="flex items-center gap-1 hover:text-primary-600">
                        <Mail size={12} /> {c.email}
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-ink-400">
                    반응: {c.reaction ?? "미확인"} · 관심도: {c.interestLevel ?? "-"} · 접촉 {c.contactCount ?? 0}회
                    {c.lastContactedAt && ` · 최근접촉 ${formatDate(c.lastContactedAt)}`}
                  </p>
                </div>
                <button
                  onClick={() => deactivateInstitutionContact(institutionId, c.id)}
                  title="퇴사/교체 (이력은 보존됩니다)"
                  className="rounded-md p-1.5 text-ink-400 hover:bg-surface-muted hover:text-status-danger"
                >
                  <UserX size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {inactiveContacts.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-ink-400">이전 담당자 {inactiveContacts.length}명 (이력)</summary>
            <ul className="mt-2 space-y-1">
              {inactiveContacts.map((c) => (
                <li key={c.id} className="text-xs text-ink-400">
                  {c.name} {c.title && `(${c.title})`} — 접촉 {c.contactCount ?? 0}회
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardBody>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="담당자 추가">
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="이름">
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="직책">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="부서">
            <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="담당업무">
            <Input value={form.responsibility} onChange={(e) => set("responsibility", e.target.value)} />
          </Field>
          <Field label="연락처">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="이메일">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="반응">
            <Select value={form.reaction} onChange={(e) => set("reaction", e.target.value as ContactReaction)}>
              {REACTIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="관심도">
            <Select value={form.interestLevel} onChange={(e) => set("interestLevel", e.target.value as InterestLevel)}>
              {INTEREST_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input type="checkbox" checked={form.isFieldContact} onChange={(e) => set("isFieldContact", e.target.checked)} />
              실무담당
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-700">
              <input type="checkbox" checked={form.isDecisionMaker} onChange={(e) => set("isDecisionMaker", e.target.checked)} />
              의사결정 관련
            </label>
          </div>
          <Field label="메모">
            <Input value={form.note} onChange={(e) => set("note", e.target.value)} className="sm:col-span-2" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "저장 중..." : "추가"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
