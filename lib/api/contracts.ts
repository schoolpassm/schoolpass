import { collection, doc, getDocs, increment, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContractDoc, SchoolPassProduct } from "@/types";
import { calculateCommission } from "@/lib/commission";

/**
 * "단위 수량 판매 방식(누적)"으로 기록된 기존 계약들에서, 같은 제품의 누적 판매 대수를 합산한다.
 * (방식2 "사업 예산 방식"은 정의상 비누적이라 여기 합산에 포함하지 않는다)
 */
export async function getCumulativeUnitsSold(product: SchoolPassProduct): Promise<number> {
  const snap = await getDocs(query(collection(db, "contracts"), where("product", "==", product), where("calcMethod", "==", "unit")));
  let total = 0;
  snap.forEach((d) => {
    const units = d.get("unitCount");
    if (typeof units === "number") total += units;
  });
  return total;
}

/**
 * 계약 생성 + 수수료 자동계산(공식 수수료 규정 기준) 스냅샷 저장 + 파트너 누계 실적 갱신
 * + 학교 상태를 '계약'으로 변경. 트랜잭션으로 묶어 데이터 정합성을 보장한다.
 */
export async function createContract(
  input: Omit<ContractDoc, "id" | "createdAt" | "updatedAt" | "commission">,
  uid: string
) {
  const previousCumulativeUnits =
    input.calcMethod === "unit" ? await getCumulativeUnitsSold(input.product) : 0;

  const commission = calculateCommission({
    method: input.calcMethod,
    product: input.product,
    unitCount: input.unitCount,
    previousCumulativeUnits,
    dealAmount: input.contractAmount,
  });

  await runTransaction(db, async (tx) => {
    const contractRef = doc(collection(db, "contracts"));
    tx.set(contractRef, {
      ...input,
      commission,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
    });

    // ZeroPass 통합 확장(2026.10): schoolId가 채워져 있으면 기존처럼 학교 쪽을 갱신하고,
    // 대신 institutionId가 채워져 있으면(관공서/민간기업 등 ZeroPass 계약) institutions 쪽을 갱신한다.
    // 기존 호출부(학교 계약)는 institutionId를 안 보내므로 동작이 전혀 바뀌지 않는다.
    if (input.schoolId) {
      tx.update(doc(db, "schools_detail", input.schoolId), { status: "계약", updatedAt: serverTimestamp() });
      tx.set(doc(db, "schools_summary", input.schoolId), { status: "계약", updatedAt: serverTimestamp() }, { merge: true });
    } else if (input.institutionId) {
      tx.update(doc(db, "institutions", input.institutionId), {
        status: "계약",
        salesStage: "계약",
        salesStageEnteredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (input.partnerId) {
      const partnerRef = doc(db, "partners", input.partnerId);
      tx.update(partnerRef, {
        contractCount: increment(1),
        totalRevenue: increment(input.contractAmount),
        totalCommission: increment(commission.totalCommission),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function updateSettlementStatus(contractId: string, status: ContractDoc["settlementStatus"]) {
  return updateDoc(doc(db, "contracts", contractId), {
    settlementStatus: status,
    updatedAt: serverTimestamp(),
  });
}
