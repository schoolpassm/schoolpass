"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createEduOffice } from "@/lib/api/educationOffices";
import { useAuth } from "@/lib/auth-context";

export function EduOfficeFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    region: "",
    department: "",
    contactName: "",
    phone: "",
    email: "",
    note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await createEduOffice(form, firebaseUser.uid);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="교육지원청 등록">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="교육지원청명">
          <Input required placeholder="예: 용인교육지원청" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="지역">
          <Input required value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="담당부서">
          <Input placeholder="예: 문화복지위원회" value={form.department} onChange={(e) => set("department", e.target.value)} />
        </Field>
        <Field label="담당자">
          <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        </Field>
        <Field label="전화">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="이메일">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="비고">
          <Input value={form.note} onChange={(e) => set("note", e.target.value)} className="sm:col-span-2" />
        </Field>
        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
