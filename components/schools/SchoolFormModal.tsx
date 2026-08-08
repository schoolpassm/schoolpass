"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSchool, updateSchool } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { SchoolDoc, SchoolGrade, SchoolLevel, SchoolStatus } from "@/types";

const LEVELS: SchoolLevel[] = ["초등학교", "중학교", "고등학교", "특수학교", "유치원"];
const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"];
const GRADES: SchoolGrade[] = ["A", "B", "C", "D"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** 지정하면 수정 모드로 동작 (미지정 시 신규 등록) */
  school?: SchoolDoc;
}

export function SchoolFormModal({ open, onClose, school }: Props) {
  const { firebaseUser, userDoc } = useAuth();
  const isEdit = !!school;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: school?.name ?? "",
    region: school?.region ?? "",
    level: (school?.level ?? "고등학교") as SchoolLevel,
    address: school?.address ?? "",
    phone: school?.phone ?? "",
    adminOfficePhone: school?.adminOfficePhone ?? "",
    email: school?.email ?? "",
    contactName: school?.contactName ?? "",
    contactTitle: school?.contactTitle ?? "",
    contactPhone: school?.contactPhone ?? "",
    contactEmail: school?.contactEmail ?? "",
    studentCount: school?.studentCount ? String(school.studentCount) : "",
    ownerName: school?.ownerName ?? userDoc?.name ?? "",
    status: (school?.status ?? "신규") as SchoolStatus,
    grade: (school?.grade ?? "C") as SchoolGrade,
    tags: school?.tags?.join(", ") ?? "",
    note: school?.note ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        studentCount: Number(form.studentCount) || 0,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (isEdit && school) {
        await updateSchool(school.id, payload);
      } else {
        await createSchool(payload, firebaseUser.uid);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "학교 정보 수정" : "학교 등록"} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="학교명">
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="지역">
          <Input required placeholder="예: 경기도 용인시" value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="학교급">
          <Select value={form.level} onChange={(e) => set("level", e.target.value as SchoolLevel)}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="학생수">
          <Input type="number" value={form.studentCount} onChange={(e) => set("studentCount", e.target.value)} />
        </Field>
        <Field label="주소">
          <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="sm:col-span-2" />
        </Field>
        <Field label="전화번호 (학교 대표)">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="행정실">
          <Input value={form.adminOfficePhone} onChange={(e) => set("adminOfficePhone", e.target.value)} />
        </Field>
        <Field label="이메일 (학교 대표)">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-surface-border pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">학교측 담당자 (통화 후 개인 메일 발송·연락처 저장용)</p>
        </div>
        <Field label="담당자 성함">
          <Input placeholder="예: 김철수" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="직책">
          <Input placeholder="예: 행정실장" value={form.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} />
        </Field>
        <Field label="담당자 휴대폰">
          <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
        </Field>
        <Field label="담당자 개인 이메일">
          <Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </Field>

        <Field label="우리쪽 영업담당자">
          <Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} />
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
          <Input placeholder="신설,여름방학타겟" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
        <Field label="비고">
          <Input value={form.note} onChange={(e) => set("note", e.target.value)} className="sm:col-span-2" />
        </Field>

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : isEdit ? "수정 저장" : "학교 등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
