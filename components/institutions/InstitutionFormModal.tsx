"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createInstitution, updateInstitution } from "@/lib/api/institutions";
import { useAuth } from "@/lib/auth-context";
import { InstitutionDoc, InstitutionType, SchoolGrade, SchoolStatus } from "@/types";

const TYPES: InstitutionType[] = ["시청", "군청", "구청", "소방서", "경찰서", "국방부·군기관", "기타 공공기관"];
const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"];
const GRADES: SchoolGrade[] = ["A", "B", "C", "D"];

interface Props {
  open: boolean;
  onClose: () => void;
  institution?: InstitutionDoc; // 지정하면 수정 모드
}

export function InstitutionFormModal({ open, onClose, institution }: Props) {
  const { firebaseUser, userDoc } = useAuth();
  const isEdit = !!institution;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: institution?.name ?? "",
    type: (institution?.type ?? "시청") as InstitutionType,
    region: institution?.region ?? "",
    address: institution?.address ?? "",
    phone: institution?.phone ?? "",
    contactName: institution?.contactName ?? "",
    contactTitle: institution?.contactTitle ?? "",
    contactPhone: institution?.contactPhone ?? "",
    contactEmail: institution?.contactEmail ?? "",
    status: (institution?.status ?? "신규") as SchoolStatus,
    grade: (institution?.grade ?? "C") as SchoolGrade,
    tags: institution?.tags?.join(", ") ?? "",
    note: institution?.note ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      if (isEdit && institution) {
        await updateInstitution(institution.id, payload);
      } else {
        await createInstitution(payload, firebaseUser.uid);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "관공서 정보 수정" : "관공서 등록"} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="기관명">
          <Input required placeholder="예: 용인시청" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="기관 유형">
          <Select value={form.type} onChange={(e) => set("type", e.target.value as InstitutionType)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="지역">
          <Input required placeholder="예: 경기도 용인시" value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="대표전화">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="주소">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="sm:col-span-2" />
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-surface-border pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">
            담당자 — 청사출입보안지침상 보통 총무과 "시설관리책임자"·"보안담당관"이 담당
          </p>
        </div>
        <Field label="담당자 성함">
          <Input placeholder="예: 김철수" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="직책">
          <Input placeholder="예: 총무과 보안담당관" value={form.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} />
        </Field>
        <Field label="담당자 휴대폰">
          <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
        </Field>
        <Field label="담당자 이메일">
          <Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </Field>

        <Field label="상태">
          <Select value={form.status} onChange={(e) => set("status", e.target.value as SchoolStatus)}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="등급">
          <Select value={form.grade} onChange={(e) => set("grade", e.target.value as SchoolGrade)}>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="태그 (쉼표로 구분)">
          <Input placeholder="청사보안,신축청사" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
        <Field label="비고">
          <Input value={form.note} onChange={(e) => set("note", e.target.value)} className="sm:col-span-2" />
        </Field>

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : isEdit ? "수정 저장" : "관공서 등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
