"use client";

import { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSchedule } from "@/lib/api/schedules";
import { useAuth } from "@/lib/auth-context";
import { ScheduleType } from "@/types";
import { SchoolPickerInput } from "@/components/schools/SchoolPickerInput";

export function ScheduleFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser, userDoc } = useAuth();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ScheduleType>("visit");
  const [title, setTitle] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string } | null>(null);
  const [startAt, setStartAt] = useState("");
  const [location, setLocation] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !startAt) return;
    setSaving(true);
    try {
      await createSchedule(
        {
          type,
          title,
          schoolId: selectedSchool?.id,
          schoolName: selectedSchool?.name,
          startAt: Timestamp.fromDate(new Date(startAt)),
          location,
          assigneeUid: firebaseUser.uid,
          assigneeName: userDoc?.name ?? "",
        },
        firebaseUser.uid
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="일정 등록">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="유형">
          <Select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
            <option value="visit">방문예약</option>
            <option value="demo">시연예약</option>
            <option value="meeting">미팅</option>
            <option value="call">전화</option>
            <option value="etc">기타</option>
          </Select>
        </Field>
        <Field label="제목">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 용신고 방문 시연" />
        </Field>
        <Field label="관련 학교">
          <SchoolPickerInput value={selectedSchool} onSelect={(s) => setSelectedSchool(s)} placeholder="선택 안 함 (검색하려면 입력)" />
        </Field>
        <Field label="일시">
          <Input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label="장소">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
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
