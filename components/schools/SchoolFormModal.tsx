"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSchool } from "@/lib/api/schools";
import { useAuth } from "@/lib/auth-context";
import { SchoolGrade, SchoolLevel, SchoolStatus } from "@/types";

const LEVELS: SchoolLevel[] = ["초등학교", "중학교", "고등학교", "특수학교", "유치원"];
const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"];
const GRADES: SchoolGrade[] = ["A", "B", "C", "D"];

export function SchoolFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser, userDoc } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    region: "",
    level: "고등학교" as SchoolLevel,
    address: "",
    phone: "",
    adminOfficePhone: "",
    email: "",
    studentCount: "",
    ownerName: userDoc?.name ?? "",
    status: "신규" as SchoolStatus,
    grade: "C" as SchoolGrade,
    tags: "",
    note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await createSchool(
        {
          ...form,
          studentCount: Number(form.studentCount) || 0,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
        firebaseUser.uid
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="학교 등록" width="max-w-2xl">
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
        <Field label="전화번호">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="행정실">
          <Input value={form.adminOfficePhone} onChange={(e) => set("adminOfficePhone", e.target.value)} />
        </Field>
        <Field label="이메일">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="담당자">
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
            {saving ? "저장 중..." : "학교 등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
