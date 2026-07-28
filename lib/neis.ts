/**
 * 나이스(NEIS) 교육정보 개방포털 — 학교기본정보 API 연동
 * https://open.neis.go.kr  (Open API 신청 → 인증키 발급, 무료)
 *
 * 제공 엔드포인트: schoolInfo (학교기본정보)
 * 이 API로 가져올 수 있는 것: 학교명, 도로명주소, 전화번호, 학교급, 설립일, 교육청명 등 "기본정보"
 * 학생수/학급수는 별도 엔드포인트(school_schedule 계열이 아닌 학교급별학생현황)가 필요하며,
 * 일부 시도교육청은 미공개라 정확도가 낮아 이번 연동에서는 제외했다.
 * (필요 시 neisFetchSchoolInfo 결과에 이어 확장 가능)
 */

const NEIS_BASE_URL = "https://open.neis.go.kr/hub/schoolInfo";

/**
 * 시도교육청코드(ATPT_OFCDC_SC_CODE) — 전국 17개 시도교육청
 * name: 교육청 공식명칭(동기화 화면 드롭다운 표시용)
 * provinceName: 학교 데이터의 region 필드에 실제로 저장되는 시도명 (NEIS LCTN_SC_NM 기준)
 *   — 목록 필터는 반드시 provinceName으로 매칭해야 함. name(교육청명)으로 필터링하면
 *     region 필드값과 문자열이 달라 검색 결과가 안 나온다.
 */
export const NEIS_REGION_CODES: { code: string; name: string; provinceName: string }[] = [
  { code: "B10", name: "서울특별시교육청", provinceName: "서울특별시" },
  { code: "C10", name: "부산광역시교육청", provinceName: "부산광역시" },
  { code: "D10", name: "대구광역시교육청", provinceName: "대구광역시" },
  { code: "E10", name: "인천광역시교육청", provinceName: "인천광역시" },
  { code: "F10", name: "광주광역시교육청", provinceName: "광주광역시" },
  { code: "G10", name: "대전광역시교육청", provinceName: "대전광역시" },
  { code: "H10", name: "울산광역시교육청", provinceName: "울산광역시" },
  { code: "I10", name: "세종특별자치시교육청", provinceName: "세종특별자치시" },
  { code: "J10", name: "경기도교육청", provinceName: "경기도" },
  { code: "K10", name: "강원특별자치도교육청", provinceName: "강원특별자치도" },
  { code: "M10", name: "충청북도교육청", provinceName: "충청북도" },
  { code: "N10", name: "충청남도교육청", provinceName: "충청남도" },
  { code: "P10", name: "전북특별자치도교육청", provinceName: "전북특별자치도" },
  { code: "Q10", name: "전라남도교육청", provinceName: "전라남도" },
  { code: "R10", name: "경상북도교육청", provinceName: "경상북도" },
  { code: "S10", name: "경상남도교육청", provinceName: "경상남도" },
  { code: "T10", name: "제주특별자치도교육청", provinceName: "제주특별자치도" },
];

export interface NeisSchoolRow {
  SD_SCHUL_CODE: string; // 학교 고유코드 (동기화 기준 키)
  SCHUL_NM: string; // 학교명
  ATPT_OFCDC_SC_NM: string; // 교육청명
  SCHUL_KND_SC_NM: string; // 학교종류명 (초/중/고등학교 등)
  LCTN_SC_NM: string; // 지역명 (시/군/구)
  ORG_RDNMA?: string; // 도로명주소
  ORG_TELNO?: string; // 전화번호
  HMPG_ADRES?: string; // 홈페이지
  FOND_SC_NM?: string; // 설립구분 (공립/사립 등)
}

/**
 * 시도교육청 코드 기준으로 학교기본정보를 전체 페이지네이션하여 가져온다.
 * schoolName을 지정하면 해당 학교명 포함 검색으로 좁힌다.
 */
export async function fetchNeisSchools(
  regionCode: string,
  schoolName?: string
): Promise<NeisSchoolRow[]> {
  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    throw new Error("NEIS_API_KEY 환경변수가 설정되지 않았습니다. open.neis.go.kr 에서 인증키를 발급받으세요.");
  }

  const results: NeisSchoolRow[] = [];
  const pageSize = 1000;
  let pageIndex = 1;

  while (true) {
    const params = new URLSearchParams({
      KEY: apiKey,
      Type: "json",
      pIndex: String(pageIndex),
      pSize: String(pageSize),
      ATPT_OFCDC_SC_CODE: regionCode,
    });
    if (schoolName) params.set("SCHUL_NM", schoolName);

    const res = await fetch(`${NEIS_BASE_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`NEIS API 요청 실패: ${res.status}`);

    const json = await res.json();

    // NEIS API는 결과가 없을 때 { RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } } 형태로 응답
    const body = json.schoolInfo;
    if (!body) break;

    const rows: NeisSchoolRow[] = body[1]?.row ?? [];
    results.push(...rows);

    const totalCount = body[0]?.head?.[0]?.list_total_count ?? 0;
    if (pageIndex * pageSize >= totalCount || rows.length === 0) break;
    pageIndex += 1;
  }

  return results;
}

/** NEIS 학교종류명 → 우리 시스템의 SchoolLevel 값으로 매핑 */
export function mapNeisSchoolLevel(kndName: string): "초등학교" | "중학교" | "고등학교" | "특수학교" | "유치원" {
  if (kndName.includes("초등")) return "초등학교";
  if (kndName.includes("중학")) return "중학교";
  if (kndName.includes("고등")) return "고등학교";
  if (kndName.includes("특수")) return "특수학교";
  if (kndName.includes("유치")) return "유치원";
  return "고등학교";
}
