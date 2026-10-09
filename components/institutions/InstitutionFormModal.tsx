"use client";

import { useMemo, useState } from "react";
import { Timestamp, orderBy } from "firebase/firestore";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createInstitution, updateInstitution } from "@/lib/api/institutions";
import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/hooks/useCollection";
import {
  BudgetStatus,
  InstitutionDoc,
  InstitutionType,
  InterestLevel,
  PurchaseMethod,
  ReviewStatus,
  SalesProduct,
  SALES_PRODUCT_LABELS,
  SchoolGrade,
  SchoolStatus,
  VisitorManagementMethod,
} from "@/types";

const TYPES: InstitutionType[] = [
  "시청",
  "군청",
  "구청",
  "소방서",
  "경찰서",
  "국방부·군기관",
  "기타 공공기관",
  "교육부",
  "교육청",
  "교육지원청",
  // --- ZeroPass 통합 확장 (2026.10) ---
  "중앙행정기관",
  "공기업·공단",
  "공공시설",
  "민간기업",
  "제조공장",
  "물류센터",
  "연구소",
];
const STATUSES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중", "계약", "설치완료"];
const GRADES: SchoolGrade[] = ["A", "B", "C", "D"];
const BUDGET_STATUSES: BudgetStatus[] = ["미확인", "예산없음", "신규예산필요", "예산검토", "예산편성예정", "예산확보", "구매진행"];
const INTEREST_LEVELS: InterestLevel[] = ["높음", "보통", "낮음"];
const PRODUCTS: SalesProduct[] = ["school_pass", "zero_pass", "both"];
const VISITOR_METHODS: VisitorManagementMethod[] = ["수기대장", "엑셀", "기존시스템", "미확인"];
const REVIEW_STATUSES: ReviewStatus[] = ["검토전", "검토중", "검토완료", "보류"];
const PURCHASE_METHODS: PurchaseMethod[] = ["수의계약", "입찰", "조달청나라장터", "기타", "미확인"];

function toDateInput(ts?: Timestamp | null): string {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts as any);
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  institution?: InstitutionDoc; // 지정하면 수정 모드
}

export function InstitutionFormModal({ open, onClose, institution }: Props) {
  const { firebaseUser, userDoc } = useAuth();
  const isEdit = !!institution;
  const [saving, setSaving] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const { data: allInstitutions } = useCollection<InstitutionDoc>("institutions", [orderBy("name")]);
  const parentCandidates = useMemo(() => {
    const keyword = parentSearch.trim();
    return allInstitutions
      .filter((i) => i.id !== institution?.id) // 자기 자신은 상위기관으로 선택 불가
      .filter((i) => !keyword || i.name.includes(keyword));
  }, [allInstitutions, parentSearch, institution?.id]);
  const [form, setForm] = useState({
    name: institution?.name ?? "",
    type: (institution?.type ?? "시청") as InstitutionType,
    parentInstitutionId: institution?.parentInstitutionId ?? "",
    region: institution?.region ?? "",
    address: institution?.address ?? "",
    phone: institution?.phone ?? "",
    department: institution?.department ?? "",
    contactName: institution?.contactName ?? "",
    contactTitle: institution?.contactTitle ?? "",
    contactPhone: institution?.contactPhone ?? "",
    contactEmail: institution?.contactEmail ?? "",
    status: (institution?.status ?? "신규") as SchoolStatus,
    grade: (institution?.grade ?? "C") as SchoolGrade,
    interestLevel: (institution?.interestLevel ?? "보통") as InterestLevel,
    firstContactedAt: toDateInput(institution?.firstContactedAt),
    lastContactedAt: toDateInput(institution?.lastContactedAt),
    nextContactDueAt: toDateInput(institution?.nextContactDueAt),
    expectedAdoptionPeriod: institution?.expectedAdoptionPeriod ?? "",
    budgetStatus: (institution?.budgetStatus ?? "미확인") as BudgetStatus,
    budgetDepartment: institution?.budgetDepartment ?? "",
    budgetContactName: institution?.budgetContactName ?? "",
    expectedProjectAmount: institution?.expectedProjectAmount ? String(institution.expectedProjectAmount) : "",
    expectedContractAmount: institution?.expectedContractAmount ? String(institution.expectedContractAmount) : "",
    tags: institution?.tags?.join(", ") ?? "",
    note: institution?.note ?? "",
    // --- ZeroPass 통합 확장 (2026.10) ---
    product: institution?.product ?? "",
    visitorManagementMethod: institution?.visitorManagementMethod ?? "",
    operationalPainPoints: institution?.operationalPainPoints ?? "",
    adoptionPriority: institution?.adoptionPriority ?? "",
    purchaseMethod: institution?.purchaseMethod ?? "",
    securityReviewStatus: institution?.securityReviewStatus ?? "",
    privacyReviewStatus: institution?.privacyReviewStatus ?? "",
    pilotRunNeeded: institution?.pilotRunNeeded ?? false,
    nextAction: institution?.nextAction ?? "",
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
        parentInstitutionId: form.parentInstitutionId || undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        firstContactedAt: form.firstContactedAt ? Timestamp.fromDate(new Date(form.firstContactedAt)) : null,
        lastContactedAt: form.lastContactedAt ? Timestamp.fromDate(new Date(form.lastContactedAt)) : null,
        nextContactDueAt: form.nextContactDueAt ? Timestamp.fromDate(new Date(form.nextContactDueAt)) : null,
        expectedProjectAmount: Number(form.expectedProjectAmount) || undefined,
        expectedContractAmount: Number(form.expectedContractAmount) || undefined,
        product: (form.product || undefined) as SalesProduct | undefined,
        visitorManagementMethod: (form.visitorManagementMethod || undefined) as VisitorManagementMethod | undefined,
        purchaseMethod: (form.purchaseMethod || undefined) as PurchaseMethod | undefined,
        securityReviewStatus: (form.securityReviewStatus || undefined) as ReviewStatus | undefined,
        privacyReviewStatus: (form.privacyReviewStatus || undefined) as ReviewStatus | undefined,
      };
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
        <Field label="상위기관 (교육부→교육청→교육지원청 계층 등)">
          <div className="space-y-1.5">
            <Input
              placeholder="이름으로 검색..."
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <Select value={form.parentInstitutionId} onChange={(e) => set("parentInstitutionId", e.target.value)}>
              <option value="">(없음 — 최상위 기관)</option>
              {parentCandidates.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.type})
                </option>
              ))}
            </Select>
          </div>
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
          <p className="mb-2 text-xs font-semibold text-ink-700">제품 및 도입 현황 (ZeroPass 통합 확장)</p>
        </div>
        <Field label="제품">
          <Select value={form.product} onChange={(e) => set("product", e.target.value)}>
            <option value="">검토 필요 (미확인)</option>
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {SALES_PRODUCT_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="현재 방문자 관리 방식">
          <Select value={form.visitorManagementMethod} onChange={(e) => set("visitorManagementMethod", e.target.value)}>
            <option value="">미확인</option>
            {VISITOR_METHODS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="현재 운영상 불편">
          <Input
            placeholder="예: 외부인 출입기록이 수기라 조회가 안 됨"
            value={form.operationalPainPoints}
            onChange={(e) => set("operationalPainPoints", e.target.value)}
            className="sm:col-span-2"
          />
        </Field>
        <Field label="도입 필요성 및 우선순위">
          <Input
            placeholder="예: 보안 강화 1순위 과제로 선정됨"
            value={form.adoptionPriority}
            onChange={(e) => set("adoptionPriority", e.target.value)}
            className="sm:col-span-2"
          />
        </Field>
        <Field label="구매·계약 방식">
          <Select value={form.purchaseMethod} onChange={(e) => set("purchaseMethod", e.target.value)}>
            <option value="">미확인</option>
            {PURCHASE_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
        <Field label="시범 운영 필요 여부">
          <label className="flex h-10 items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.pilotRunNeeded}
              onChange={(e) => set("pilotRunNeeded", e.target.checked)}
              className="h-4 w-4 accent-primary-500"
            />
            시범 운영(PoC) 필요
          </label>
        </Field>
        <Field label="정보보안 검토 상태">
          <Select value={form.securityReviewStatus} onChange={(e) => set("securityReviewStatus", e.target.value)}>
            <option value="">검토 필요 (미확인)</option>
            {REVIEW_STATUSES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="개인정보 처리 검토 상태">
          <Select value={form.privacyReviewStatus} onChange={(e) => set("privacyReviewStatus", e.target.value)}>
            <option value="">검토 필요 (미확인)</option>
            {REVIEW_STATUSES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="다음 행동">
          <Input
            placeholder="예: 보안담당관에게 정보보안 검토 요청 이메일 발송"
            value={form.nextAction}
            onChange={(e) => set("nextAction", e.target.value)}
            className="sm:col-span-2"
          />
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-surface-border pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">
            담당자 — 청사출입보안지침상 보통 총무과 "시설관리책임자"·"보안담당관"이 담당
          </p>
        </div>
        <Field label="담당부서">
          <Input placeholder="예: 총무과" value={form.department} onChange={(e) => set("department", e.target.value)} />
        </Field>
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
        <Field label="관심도">
          <Select value={form.interestLevel} onChange={(e) => set("interestLevel", e.target.value as InterestLevel)}>
            {INTEREST_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-surface-border pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">접촉 일정</p>
        </div>
        <Field label="최초 접촉일">
          <Input type="date" value={form.firstContactedAt} onChange={(e) => set("firstContactedAt", e.target.value)} />
        </Field>
        <Field label="최근 접촉일">
          <Input type="date" value={form.lastContactedAt} onChange={(e) => set("lastContactedAt", e.target.value)} />
        </Field>
        <Field label="다음 접촉 예정일">
          <Input type="date" value={form.nextContactDueAt} onChange={(e) => set("nextContactDueAt", e.target.value)} />
        </Field>
        <Field label="예상 도입 시기">
          <Input placeholder="예: 2026년 3분기" value={form.expectedAdoptionPeriod} onChange={(e) => set("expectedAdoptionPeriod", e.target.value)} />
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-surface-border pt-3">
          <p className="mb-2 text-xs font-semibold text-ink-700">예산 현황</p>
        </div>
        <Field label="예산 상태">
          <Select value={form.budgetStatus} onChange={(e) => set("budgetStatus", e.target.value as BudgetStatus)}>
            {BUDGET_STATUSES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="예산 담당부서">
          <Input value={form.budgetDepartment} onChange={(e) => set("budgetDepartment", e.target.value)} />
        </Field>
        <Field label="예산 담당자">
          <Input value={form.budgetContactName} onChange={(e) => set("budgetContactName", e.target.value)} />
        </Field>
        <Field label="예상 사업금액 (원)">
          <Input type="number" value={form.expectedProjectAmount} onChange={(e) => set("expectedProjectAmount", e.target.value)} />
        </Field>
        <Field label="예상 계약금액 (원)">
          <Input type="number" value={form.expectedContractAmount} onChange={(e) => set("expectedContractAmount", e.target.value)} />
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
