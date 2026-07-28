"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createPartner } from "@/lib/api/partners";
import { useAuth } from "@/lib/auth-context";
import { CommissionZone } from "@/types";

export function PartnerFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    region: "",
    zone: "공동권역" as CommissionZone,
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
      await createPartner(form, firebaseUser.uid);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="파트너 등록">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="파트너명">
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="지역">
          <Input required value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="권역 (수수료 배분 기준)">
          <Select value={form.zone} onChange={(e) => set("zone", e.target.value as CommissionZone)}>
            <option value="공동권역">공동권역 (본인10/사촌10/영업10/운영5)</option>
            <option value="신규권역">신규권역 (본인11/사촌9/영업10/운영5)</option>
            <option value="사촌권역">사촌권역 (본인9/사촌11/영업10/운영5)</option>
          </Select>
        </Field>
        <Field label="전화">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="이메일">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="메모">
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
