"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createCase } from "@/lib/api/cases";
import { useAuth } from "@/lib/auth-context";

export function CaseFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ schoolName: "", region: "", installYear: String(new Date().getFullYear()), review: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const [pdfs, setPdfs] = useState<File[]>([]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await createCase(
        { schoolName: form.schoolName, region: form.region, installYear: Number(form.installYear), review: form.review, published: true },
        photos,
        pdfs,
        firebaseUser.uid
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="구축사례 등록">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="학교명">
          <Input required value={form.schoolName} onChange={(e) => set("schoolName", e.target.value)} />
        </Field>
        <Field label="지역">
          <Input required value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="설치년도">
          <Input type="number" value={form.installYear} onChange={(e) => set("installYear", e.target.value)} />
        </Field>
        <Field label="후기">
          <Input value={form.review} onChange={(e) => set("review", e.target.value)} />
        </Field>
        <Field label="사진 (여러장 선택 가능)">
          <input type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} className="text-xs" />
        </Field>
        <Field label="PDF 첨부">
          <input type="file" accept="application/pdf" multiple onChange={(e) => setPdfs(Array.from(e.target.files ?? []))} className="text-xs" />
        </Field>
        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "업로드 중..." : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
