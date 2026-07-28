"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createContract } from "@/lib/api/contracts";
import { calculateCommission, formatKRW } from "@/lib/commission";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { PartnerDoc, CommissionZone } from "@/types";
import { Timestamp } from "firebase/firestore";
import { SchoolPickerInput } from "@/components/schools/SchoolPickerInput";

export function ContractFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser, userDoc } = useAuth();
  const { data: partners } = useCollection<PartnerDoc>("partners");
  const [saving, setSaving] = useState(false);

  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string; region: string } | null>(null);
  const [contractAmount, setContractAmount] = useState("");
  const [installAmount, setInstallAmount] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [zone, setZone] = useState<CommissionZone>("공동권역");
  const [partnerId, setPartnerId] = useState("");

  const selectedPartner = partners.find((p) => p.id === partnerId);
  const amountNum = Number(contractAmount) || 0;
  const schoolId = selectedSchool?.id ?? "";

  const preview = useMemo(() => calculateCommission(amountNum, zone), [amountNum, zone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !selectedSchool) return;
    setSaving(true);
    try {
      await createContract(
        {
          schoolId,
          schoolName: selectedSchool.name,
          region: selectedSchool.region,
          contractAmount: amountNum,
          installAmount: Number(installAmount) || 0,
          installDate: installDate ? Timestamp.fromDate(new Date(installDate)) : null,
          contractDate: contractDate ? Timestamp.fromDate(new Date(contractDate)) : null,
          salesOwnerUid: firebaseUser.uid,
          salesOwnerName: userDoc?.name ?? "",
          partnerId: partnerId || undefined,
          partnerName: selectedPartner?.name,
          zone,
          settlementStatus: "정산대기",
        },
        firebaseUser.uid
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="계약 등록" width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="학교">
            <SchoolPickerInput value={selectedSchool} onSelect={(s) => setSelectedSchool(s)} />
          </Field>
          <Field label="지역파트너">
            <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">없음</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="계약금액">
            <Input type="number" required value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} placeholder="예: 20000000" />
          </Field>
          <Field label="설치금액">
            <Input type="number" value={installAmount} onChange={(e) => setInstallAmount(e.target.value)} />
          </Field>
          <Field label="계약일">
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
          </Field>
          <Field label="설치일">
            <Input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
          </Field>
          <Field label="권역 (수수료 배분 기준)">
            <Select value={zone} onChange={(e) => setZone(e.target.value as CommissionZone)}>
              <option value="공동권역">공동권역</option>
              <option value="신규권역">신규권역</option>
              <option value="사촌권역">사촌권역</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4">
          <p className="mb-2 text-xs font-semibold text-primary-700">수익 자동계산 (기본수수료 35%)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PreviewItem label="본인" value={preview.self} sub={`${(preview.selfRate * 100).toFixed(0)}%`} />
            <PreviewItem label="사촌" value={preview.cousin} sub={`${(preview.cousinRate * 100).toFixed(0)}%`} />
            <PreviewItem label="영업" value={preview.sales} sub={`${(preview.salesRate * 100).toFixed(0)}%`} />
            <PreviewItem label="운영비" value={preview.operation} sub={`${(preview.operationRate * 100).toFixed(0)}%`} />
          </div>
          <p className="mt-2 text-right text-xs text-primary-700">
            기본수수료 합계 <span className="font-bold">{formatKRW(preview.baseCommission)}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={saving || !schoolId}>
            {saving ? "저장 중..." : "계약 등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PreviewItem({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-md bg-white p-2 text-center shadow-card">
      <p className="text-[11px] text-ink-500">{label} ({sub})</p>
      <p className="text-sm font-bold text-ink-900">{formatKRW(value)}</p>
    </div>
  );
}
