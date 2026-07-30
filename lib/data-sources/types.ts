/**
 * 외부 데이터소스 확장 구조
 * ---------------------------------------------------------------------------
 * 지금 실제로 연동된 것: NEIS(학교기본정보), schoolinfo.go.kr(학생수 등 8종 공시자료).
 * 아래는 "향후 추가할 수 있는 구조"만 정의해둔 것이며, 실제 API 연동 코드는 아직 없다.
 * 나라장터/KEDI/학교 홈페이지 공지 등은 실제 API 스펙(요청 URL·인증방식·응답 필드)을
 * 확인하기 전까지 추측으로 만들면 잘못된 코드가 되므로, 여기서는 인터페이스만 준비해둔다.
 *
 * 새 데이터소스를 실제로 붙일 때 할 일:
 * 1. lib/data-sources/{name}.ts 에 이 인터페이스를 구현하는 파일 추가
 * 2. DATA_SOURCE_REGISTRY에 등록
 * 3. app/api/schools/sync-public-data-chunk 패턴을 참고해 동기화 라우트 추가
 *    (lib/schoolinfo.ts의 SCHOOLINFO_CATEGORIES 구조를 그대로 참고하면 된다)
 * ---------------------------------------------------------------------------
 */

export interface DataSourceRecord {
  /** 학교를 식별할 키 (표준학교코드 또는 학교명 등, 소스마다 다를 수 있음) */
  schoolKey: string;
  schoolName?: string;
  /** 이 레코드에서 뽑아낸, schools_detail에 반영할 필드들 */
  fields: Record<string, unknown>;
}

export interface DataSourceAdapter {
  /** 예: "나라장터 입찰정보", "KEDI 학교정보", "학교 홈페이지 공지" */
  label: string;
  /** UI 표시/식별용 고유 키 */
  key: string;
  /** 실제 데이터 조회. 구현 전까지는 "미구현" 에러를 던지는 스텁이다. */
  fetch: (params: Record<string, unknown>) => Promise<DataSourceRecord[]>;
  /** schools_detail 문서와 매칭하는 방법 (코드 매칭 vs 이름+지역 매칭) */
  matchStrategy: "schoolCode" | "nameAndRegion";
}

/**
 * 실제 연동은 안 됐지만, 향후 붙일 자리를 표시해둔 스텁 어댑터들.
 * fetch()를 호출하면 명시적으로 에러를 던지므로, 실수로 빈 데이터가 조용히
 * 반영되는 일은 없다 — 실제 구현 시 이 부분만 진짜 fetch 로직으로 교체하면 된다.
 */
function notImplemented(label: string): DataSourceAdapter["fetch"] {
  return async () => {
    throw new Error(
      `${label} 연동은 아직 구현되지 않았습니다. 실제 API 스펙 확인 후 lib/data-sources/ 에 구현을 추가하세요.`
    );
  };
}

export const DATA_SOURCE_REGISTRY: DataSourceAdapter[] = [
  {
    key: "g2b_bids",
    label: "나라장터 입찰정보",
    matchStrategy: "nameAndRegion",
    fetch: notImplemented("나라장터 입찰정보"),
  },
  {
    key: "kedi_school_info",
    label: "KEDI 학교정보",
    matchStrategy: "schoolCode",
    fetch: notImplemented("KEDI 학교정보"),
  },
  {
    key: "school_website_notice",
    label: "학교 홈페이지 공지사항 (시설공사/안전 관련)",
    matchStrategy: "nameAndRegion",
    fetch: notImplemented("학교 홈페이지 공지사항"),
  },
];
