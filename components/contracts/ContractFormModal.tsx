"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createContract, getCumulativeUnitsSold } from "@/lib/api/contracts";
import { formatKRW, PRODUCT_LABEL, PRODUCT_UNIT_PRICE } from "@/lib/commission";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import { PartnerDoc, SchoolPassProduct, CommissionCalcMethod } from "@/types";
import { Timestamp } from "firebase/firestore";
import { SchoolPickerInput } from "@/components/schools/SchoolPickerInput";

export function ContractFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { firebaseUser, userDoc } = useAuth();
  const { data: partners } = useCollection<PartnerDoc>("partners");
  const [saving, setSaving] = useState(false);

  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string; region: string } | null>(null);
  const [product, setProduct] = useState<SchoolPassProduct>("school_pass");
  const [calcMethod, setCalcMethod] = useState<CommissionCalcMethod>("unit");
  const [unitCount, setUnitCount] = useState("1");
  const [dealAmount, setDealAmount] = useState("");
  const [installAmount, setInstallAmount] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10));
  const [partnerId, setPartnerId] = useState("");
  const [cumulativeUnits, setCumulativeUnits] = useState(0);
  const [loadingCumulative, setLoadingCumulative] = useState(false);

  const selectedPartner = partners.find((p) => p.id === partnerId);
  const schoolId = selectedSchool?.id ?? "";

  useEffect(() => {
    if (calcMethod !== "unit") return;
    let cancelled = false;
    setLoadingCumulative(true);
    getCumulativeUnitsSold(product)
      .then((n) => {
        if (!cancelled) setCumulativeUnits(n);
      })
      .finally(() => {
        if (!cancelled) setLoadingCumulative(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product, calcMethod]);

  const contractAmount = useMemo(() => {
    if (calcMethod === "unit") return (Number(unitCount) || 0) * PRODUCT_UNIT_PRICE[product];
    return Number(dealAmount) || 0;
  }, [calcMethod, unitCount, product, dealAmount]);

  // 수수료 미리보기는 화면에 노출하지 않음(수익 부분 비공개 정책) — 실제 계산·저장은 createContract 내부에서 그대로 수행됨

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
          contractAmount,
          installAmount: Number(installAmount) || 0,
          installDate: installDate ? Timestamp.fromDate(new Date(installDate)) : null,
          contractDate: contractDate ? Timestamp.fromDate(new Date(contractDate)) : null,
          salesOwnerUid: firebaseUser.uid,
          salesOwnerName: userDoc?.name ?? "",
          partnerId: partnerId || undefined,
          partnerName: selectedPartner?.name,
          product,
          calcMethod,
          unitCount: calcMethod === "unit" ? Number(unitCount) || 0 : undefined,
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
          <Field label="제품">
            <Select value={product} onChange={(e) => setProduct(e.target.value as SchoolPassProduct)}>
              <option value="school_pass">
                {PRODUCT_LABEL.school_pass} ({formatKRW(PRODUCT_UNIT_PRICE.school_pass)}/대)
              </option>
              <option value="zero_pass">
                {PRODUCT_LABEL.zero_pass} ({formatKRW(PRODUCT_UNIT_PRICE.zero_pass)}/대)
              </option>
            </Select>
          </Field>
          <Field label="수수료 산정 방식">
            <Select value={calcMethod} onChange={(e) => setCalcMethod(e.target.value as CommissionCalcMethod)}>
              <option value="unit">단위 수량 판매 (누적 집계 — 1~10대 20%, 11대~ 25%)</option>
              <option value="project">사업 예산 방식 (건별 — 25~36%, 대형사업용)</option>
            </Select>
          </Field>

          {calcMethod === "unit" ? (
            <Field label={`판매 대수 (${PRODUCT_LABEL[product]} 누적 ${loadingCumulative ? "확인 중..." : `${cumulativeUnits}대`} 이후)`}>
              <Input type="number" min={1} required value={unitCount} onChange={(e) => setUnitCount(e.target.value)} />
            </Field>
          ) : (
            <Field label="사업 총 금액 (부가세 포함)">
              <Input type="number" required value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} placeholder="예: 1200000000" />
            </Field>
          )}

          <Field label="계약금액 (자동계산)">
            <Input value={formatKRW(contractAmount)} disabled />
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
