/**
 * 학교알리미(schoolinfo.go.kr) OpenAPI 연동 — 학년별·학급별 학생수(apiType=09)
 * 나이스 개방포털(open.neis.go.kr)과는 완전히 별개의 사이트/인증키다.
 * 인증키 발급: schoolinfo.go.kr 로그인(네이버/카카오) → OpenAPI → 인증키 신청
 */

const SCHOOLINFO_BASE_URL = "http://www.schoolinfo.go.kr/openApi.do";

/** schulKndCode 값: 02:초등 03:중등 04:고등 05:특수 06:그외 07:각종 */
export const SCHOOLINFO_LEVEL_CODES: { code: string; label: string }[] = [
  { code: "02", label: "초등학교" },
  { code: "03", label: "중학교" },
  { code: "04", label: "고등학교" },
  { code: "05", label: "특수학교" },
];

export interface SchoolinfoStudentCountRow {
  SCHUL_CODE: string; // 정보공시 학교코드 (NEIS SD_SCHUL_CODE와 동일한 표준학교코드로 간주하고 매칭)
  SCHUL_NM: string;
  COL_S_SUM?: string; // 학생수(계)
  COL_C_SUM?: string; // 학급수(계)
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

export async function fetchStudentCounts(
  year: number,
  schulKndCode: string,
  sidoCode?: string
): Promise<SchoolinfoStudentCountRow[]> {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    throw new Error("SCHOOLINFO_API_KEY 환경변수가 설정되지 않았습니다. schoolinfo.go.kr에서 인증키를 발급받으세요.");
  }

  const params = new URLSearchParams({
    apiKey,
    apiType: "09",
    pbanYr: String(year),
    schulKndCode,
  });
  if (sidoCode) params.set("sidoCode", sidoCode);

  const res = await fetch(`${SCHOOLINFO_BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`학교알리미 API 요청 실패: ${res.status}`);

  const json = await res.json();
  return findRecordArray(json) ?? [];
}
