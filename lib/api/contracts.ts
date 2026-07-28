import { addDoc, collection, doc, increment, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContractDoc } from "@/types";
import { calculateCommission } from "@/lib/commission";

/**
 * 계약 생성 + 수수료 자동계산 스냅샷 저장 + 파트너 누계 실적 갱신 + 학교 상태를 '계약'으로 변경
 * 트랜잭션으로 묶어 데이터 정합성을 보장한다.
 */
export async function createContract(
  input: Omit<ContractDoc, "id" | "createdAt" | "updatedAt" | "commission">,
  uid: string
) {
  const commission = calculateCommission(input.contractAmount, input.zone);

  await runTransaction(db, async (tx) => {
    const contractRef = doc(collection(db, "contracts"));
    tx.set(contractRef, {
      ...input,
      commission,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
    });

    // 학교 상태를 계약으로 갱신
    const schoolRef = doc(db, "schools", input.schoolId);
    tx.update(schoolRef, { status: "계약", updatedAt: serverTimestamp() });

    // 파트너 누계 실적 갱신 (지정된 경우)
    if (input.partnerId) {
      const partnerRef = doc(db, "partners", input.partnerId);
      tx.update(partnerRef, {
        contractCount: increment(1),
        totalRevenue: increment(input.contractAmount),
        totalCommission: increment(commission.baseCommission),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function updateContractAmount(contractId: string, contractAmount: number, zone: ContractDoc["zone"]) {
  const commission = calculateCommission(contractAmount, zone);
  return updateDoc(doc(db, "contracts", contractId), {
    contractAmount,
    zone,
    commission,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSettlementStatus(contractId: string, status: ContractDoc["settlementStatus"]) {
  return updateDoc(doc(db, "contracts", contractId), {
    settlementStatus: status,
    updatedAt: serverTimestamp(),
  });
}
