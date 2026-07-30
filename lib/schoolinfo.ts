/**
 * 학교알리미(schoolinfo.go.kr) OpenAPI 연동.
 * 나이스 개방포털(open.neis.go.kr)과는 완전히 별개의 사이트/인증키다.
 * 인증키 발급: schoolinfo.go.kr 로그인(네이버/카카오) → OpenAPI → 인증키 신청
 *
 * apiType별로 출력 필드가 다르므로, 카테고리마다 apiType + "필요한 필드만 SchoolDoc patch로
 * 변환하는 함수"를 SCHOOLINFO_CATEGORIES에 등록해두는 방식으로 일반화했다.
 * 새 카테고리를 추가하려면 이 파일에 항목 하나만 추가하면 된다 (라우트/UI 쪽 로직은 그대로 재사용).
 */

const SCHOOLINFO_BASE_URL = "https://www.schoolinfo.go.kr/openApi.do";

/** schulKndCode 값: 02:초등 03:중등 04:고등 05:특수 06:그외 07:각종 */
export const SCHOOLINFO_LEVEL_CODES: { code: string; label: string }[] = [
  { code: "02", label: "초등학교" },
  { code: "03", label: "중학교" },
  { code: "04", label: "고등학교" },
  { code: "05", label: "특수학교" },
];

export type SchoolinfoCategory =
  | "student_count"
  | "teacher_count"
  | "finance"
  | "development_fund"
  | "support_facility"
  | "facility_safety"
  | "school_land"
  | "health";

export interface SchoolinfoCategoryMeta {
  apiType: string;
  label: string;
  /** apiType별로 필요한 추가 필수 파라미터 (예: 학교회계는 depthNo/depthNo2 필요) */
  extraParams?: Record<string, string>;
}

export const SCHOOLINFO_CATEGORIES: Record<SchoolinfoCategory, SchoolinfoCategoryMeta> = {
  student_count: { apiType: "09", label: "학생수·학급수" },
  teacher_count: { apiType: "22", label: "교직원수" },
  // depthNo(10:예산 20:결산) + depthNo2(1:세입예산 2:세출예산 3:세입결산 4:세출결산) 둘 다 필수.
  // "세입 규모" 판단이 목적이므로 결산(확정치) 기준 세입(depthNo2=3)을 사용한다.
  finance: { apiType: "27", label: "학교회계(세입 규모)", extraParams: { depthNo: "20", depthNo2: "3" } },
  development_fund: { apiType: "30", label: "학교발전기금" },
  support_facility: { apiType: "18", label: "학생지원시설" },
  facility_safety: { apiType: "44", label: "시설안전 점검" },
  school_land: { apiType: "16", label: "학교용지 면적" },
  health: { apiType: "38", label: "보건관리" },
};

export interface SchoolinfoRow {
  SCHUL_CODE: string;
  SCHUL_NM: string;
  [key: string]: unknown;
}

/** 카테고리별 응답 로우를 schools_detail/summary에 반영할 필드 patch로 변환한다. */
export function extractFieldsForCategory(category: SchoolinfoCategory, row: SchoolinfoRow): Record<string, unknown> {
  const num = (v: unknown) => {
    const n = parseInt(String(v ?? ""), 10);
    return isNaN(n) ? undefined : n;
  };

  // JU_ORG_NM(교육지원청명)은 모든 카테고리 응답에 공통으로 포함되어 있어, 어떤 동기화를 돌리든 항상 반영한다.
  const common: Record<string, unknown> = row.JU_ORG_NM ? { eduOfficeName: String(row.JU_ORG_NM) } : {};

  switch (category) {
    case "student_count": {
      const studentCount = num(row.COL_S_SUM);
      const classCount = num(row.COL_C_SUM);
      return { ...common, ...(studentCount != null && { studentCount }), ...(classCount != null && { classCount }) };
    }
    case "teacher_count": {
      const teacherCount = num(row.COL_S); // 총계(계)
      return { ...common, ...(teacherCount != null && { teacherCount }) };
    }
    case "finance": {
      const amounts = ["AMT1", "AMT2", "AMT3", "AMT4", "AMT5", "AMT6"].map((k) => num(row[k]) ?? 0);
      const total = amounts.reduce((a, b) => a + b, 0);
      return { ...common, ...(total > 0 && { financeRevenueTotal: total }) };
    }
    case "development_fund": {
      const total = num(row.AMT_SMTOT);
      return { ...common, ...(total != null && { developmentFundTotal: total }) };
    }
    case "support_facility": {
      const gym = num(row.COL_1) ?? 0;
      const auditorium = num(row.COL_2) ?? 0;
      const pool = num(row.SWMPL_FGR) ?? 0;
      const careerRoom = num(row.COSE_CNSRM_FGR) ?? 0;
      return { ...common, supportFacilities: { gym, auditorium, pool, careerRoom } };
    }
    case "facility_safety": {
      const checkedDate = row.CK_YMD ? String(row.CK_YMD) : undefined;
      const resultCode = row.CK_RSLT_CODE ? String(row.CK_RSLT_CODE) : undefined;
      return {
        ...common,
        ...(checkedDate && { facilitySafetyCheckedDate: checkedDate }),
        ...(resultCode && { facilitySafetyOk: resultCode !== "" }),
      };
    }
    case "school_land": {
      const area = num(row.COL_5);
      return { ...common, ...(area != null && { schoolLandArea: area }) };
    }
    case "health": {
      const usageCount = num(row.ALL_IFRMA_UTILZ_STDNT_FGR);
      return { ...common, ...(usageCount != null && { healthRoomUsageCount: usageCount }) };
    }
  }
}

/**
 * 응답 JSON의 정확한 감싸는 구조(envelope)가 문서화되어 있지 않아,
 * 어떤 형태로 오든 "SCHUL_CODE 필드를 가진 객체 배열"을 재귀적으로 찾아내는 방식으로 방어적으로 파싱한다.
 */
function findRecordArray(node: unknown, depth = 0): any[] | null {
  if (depth > 6 || node == null) return null;
  if (Array.isArray(node)) {
    if (node.length > 0 && typeof node[0] === "object" && node[0] !== null && "SCHUL_CODE" in node[0]) {
      return node;
    }
    for (const item of node) {
      const found = findRecordArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const found = findRecordArray((node as Record<string, unknown>)[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function fetchSchoolinfoRows(
  category: SchoolinfoCategory,
  year: number,
  schulKndCode: string,
  sggCode: string,
  sidoCode: string
): Promise<SchoolinfoRow[]> {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    throw new Error("SCHOOLINFO_API_KEY 환경변수가 설정되지 않았습니다. schoolinfo.go.kr에서 인증키를 발급받으세요.");
  }

  const params = new URLSearchParams({
    apiKey,
    apiType: SCHOOLINFO_CATEGORIES[category].apiType,
    pbanYr: String(year),
    schulKndCode,
    sggCode,
    sidoCode,
    ...(SCHOOLINFO_CATEGORIES[category].extraParams ?? {}),
  });

  const res = await fetch(`${SCHOOLINFO_BASE_URL}?${params.toString()}`, { cache: "no-store" });
  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`학교알리미 API 요청 실패 (${res.status}): ${rawText.slice(0, 200)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`학교알리미 응답이 JSON이 아님: ${rawText.slice(0, 200)}`);
  }

  const OK_CODES = new Set(["success", "00", "0", "info-000", "ok"]);
  if (json && typeof json === "object" && ("resultCode" in (json as any) || "RESULT" in (json as any))) {
    const errObj = (json as any).resultCode ? json : (json as any).RESULT;
    const code = errObj?.resultCode ?? errObj?.CODE;
    const msg = errObj?.resultMsg ?? errObj?.MESSAGE;
    if (code && !OK_CODES.has(String(code).toLowerCase())) {
      throw new Error(`학교알리미 API 오류 응답 [${code}]: ${msg ?? rawText.slice(0, 200)}`);
    }
  }

  return (findRecordArray(json) ?? []) as SchoolinfoRow[];
}
