// ============================================================================
// SchoolPass CRM 데이터 모델
// 이 파일의 타입은 Firestore 컬렉션 구조와 1:1로 매핑된다.
// (컬렉션 설계 문서: /docs/firestore-schema.md 참고)
// ============================================================================

import { Timestamp } from "firebase/firestore";

/** 모든 문서 공통 필드 */
export interface BaseDoc {
  id: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy?: string; // uid
}

// ----------------------------------------------------------------------------
// 1. users (Firebase Auth uid = 문서ID)
// ----------------------------------------------------------------------------
export type UserRole = "admin" | "manager" | "partner";

export interface UserDoc extends BaseDoc {
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  region?: string; // 담당 권역
  partnerId?: string; // role이 partner인 경우 partners 컬렉션 참조
  active: boolean;
  photoURL?: string;
}

// ----------------------------------------------------------------------------
// 2. schools_detail (전체 상세 정보) + schools_summary (지도/목록용 경량 문서)
// ----------------------------------------------------------------------------
export type SchoolLevel = "초등학교" | "중학교" | "고등학교" | "특수학교" | "유치원";
export type SchoolGrade = "A" | "B" | "C" | "D";
export type SchoolStatus =
  | "신규"
  | "전화완료"
  | "자료발송"
  | "방문예정"
  | "시연"
  | "견적"
  | "협의중"
  | "계약"
  | "설치완료"
  | "보류"
  | "실패";

/**
 * schools_detail/{schoolId} — 전체 상세 문서 (Source of Truth).
 * 학교 상세페이지에서만 조회한다. 목록/지도/칸반에서는 절대 이 컬렉션을 조회하지 않는다.
 */
export interface SchoolDoc extends BaseDoc {
  name: string; // 학교명
  region: string; // 지역 (시/도)
  district?: string; // 구/군
  level: SchoolLevel; // 학교급
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  adminOfficePhone?: string; // 행정실
  email?: string;
  // --- 학교측 담당자(개인) 연락처 — 대표 전화/이메일(위)과 별개, 통화 후 개인 메일 발송/휴대폰 저장용 ---
  contactName?: string; // 담당자 성함
  contactTitle?: string; // 직책 (예: 행정실장, 교감 등)
  contactPhone?: string; // 담당자 개인 휴대폰
  contactEmail?: string; // 담당자 개인 이메일
  eduOfficeId?: string; // 교육지원청 참조 (educationOffices/{id})
  studentCount?: number; // 학생수
  classCount?: number; // 학급수
  hasKindergarten?: boolean; // 병설유치원 운영 여부
  ownerUid?: string; // 담당자 uid
  ownerName?: string; // 담당자 이름 (비정규화, 목록 렌더링용)
  status: SchoolStatus; // 영업 파이프라인 상태 (칸반 컬럼과 동일 값)
  grade: SchoolGrade; // A/B/C/D 등급
  tags: string[];
  note?: string;
  partnerId?: string; // 연결된 지역 파트너
  isNewlyOpened?: boolean; // 신설 학교 여부 (NEIS 설립일자 기준 자동 감지, 최근 3년 이내 개교)
  isClosed?: boolean; // 폐교 여부 (NEIS 동기화로 감지)
  foundationType?: string; // 공립/사립 등 설립구분 (NEIS FOND_SC_NM)
  archived?: boolean;
  // --- 학교알리미(NEIS) 자동 동기화 관련 ---
  neisSchoolCode?: string; // NEIS SD_SCHUL_CODE, 동기화 매칭 기준 키
  syncedFromNeis?: boolean; // NEIS 동기화로 생성된 레코드인지 여부
  lastSyncedAt?: Timestamp | null; // 마지막 NEIS 동기화 시각
  // --- AI 영업도구 ---
  aiScore?: number | null; // AI가 산정한 계약 가능성 점수 (0~100)
  aiScoreReason?: string; // 점수 산정 근거 (사람이 읽는 요약 텍스트)
  aiScoreFactors?: AiScoreFactor[]; // 구조화된 근거 목록 (뱃지 렌더링용)
  aiScoreUpdatedAt?: Timestamp | null;
  lastContactedAt?: Timestamp | null; // 최근 접촉일 (활동기록 생성 시 자동 갱신, "이번주 전화 대상" 계산용)
  // --- 학교알리미 추가 공시데이터 (교직원수/학교회계/발전기금/시설/시설안전/학교용지/보건) ---
  teacherCount?: number; // 교직원수(총계)
  eduOfficeName?: string; // 교육지원청명 (schoolinfo JU_ORG_NM, 시도교육청보다 세분화된 실제 관할 교육지원청)
  financeRevenueTotal?: number; // 학교회계 세입 규모
  developmentFundTotal?: number; // 학교발전기금 금액합계
  supportFacilities?: { gym: number; auditorium: number; pool: number; careerRoom: number }; // 학생지원시설
  facilitySafetyCheckedDate?: string; // 시설안전 최종점검일자 (YYYYMMDD)
  facilitySafetyOk?: boolean; // 시설안전 점검 이상없음 여부
  schoolLandArea?: number; // 학교용지 면적 합계(㎡)
  healthRoomUsageCount?: number; // 연간 보건실 이용건수
}

/**
 * schools_summary/{schoolId} — schools_detail과 동일한 문서ID를 쓰는 경량 사본.
 * 목록/지도/칸반/대시보드는 반드시 이 컬렉션만 조회한다 (필드 수·페이로드를 최소화해
 * 학교가 10만 건이 되어도 목록·지도 렌더링 성능이 유지되도록 함).
 * schools_detail이 변경될 때마다 lib/api/schools.ts의 CRUD 함수가 배치 쓰기로 동기화한다.
 */
export interface SchoolSummaryDoc {
  id: string;
  name: string;
  region: string;
  district?: string;
  level: SchoolLevel;
  status: SchoolStatus;
  grade: SchoolGrade;
  lat?: number;
  lng?: number;
  address?: string; // 빠른액션(지도열기)용, 크기가 작아 요약에 포함
  phone?: string; // 빠른액션(전화/문자)용
  email?: string; // 빠른액션(이메일)용
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  studentCount?: number;
  ownerUid?: string; // 담당자 uid (칸반보드에서 "내 것만 이동 가능" 권한체크용)
  ownerName?: string;
  partnerId?: string;
  eduOfficeId?: string;
  eduOfficeName?: string;
  financeRevenueTotal?: number; // 학교회계 세입 규모 (예산기반 추천용, 요약에도 반영)
  developmentFundTotal?: number; // 학교발전기금 (예산기반 추천용)
  tags: string[];
  isNewlyOpened?: boolean;
  aiScore?: number | null;
  lastContactedAt?: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** AI 계약가능성 점수의 구조화된 근거 한 줄 */
export interface AiScoreFactor {
  label: string; // 예: "같은 교육지원청 구축학교 6곳"
  positive: boolean; // 가점 요인인지 감점 요인인지
}

/** schools/{schoolId}/activities - 전화/이메일/문자/방문 기록 통합 타임라인 */
export type ActivityType = "call" | "email" | "sms" | "visit" | "memo" | "status_change";

export interface SchoolActivityDoc extends BaseDoc {
  type: ActivityType;
  summary: string; // 통화 요약, 방문 메모 등
  result?: string; // 통화결과: 부재중/거절/긍정적/약속확정 등
  nextActionAt?: Timestamp | null; // 다음 액션 예정일 (팔로업 알림용)
  authorUid: string;
  authorName: string;
}

/** schools/{schoolId}/quotes - 견적 이력 */
export interface SchoolQuoteDoc extends BaseDoc {
  amount: number;
  itemSummary: string;
  validUntil?: Timestamp | null;
  fileUrl?: string;
  status: "draft" | "sent" | "accepted" | "rejected";
}

/** schools/{schoolId}/files - 브로슈어/사진/제안서 등 첨부파일 메타데이터 */
export type SchoolFileCategory = "brochure" | "photo" | "proposal" | "contract" | "etc";

export interface SchoolFileDoc extends BaseDoc {
  category: SchoolFileCategory;
  fileName: string;
  url: string; // Storage 다운로드 URL
  storagePath: string; // 삭제용 경로
  sizeBytes?: number;
  uploadedByUid: string;
}

/** schools_detail/{schoolId}/ai_logs — AI 생성 이력 (재생성 시 이전 결과 추적용) */
export interface AiLogDoc extends BaseDoc {
  action: string;
  model: string;
  resultText: string;
  score?: number | null;
  requestedByUid: string;
}

// ----------------------------------------------------------------------------
// 3. educationOffices (교육지원청)
// ----------------------------------------------------------------------------
export interface EducationOfficeDoc extends BaseDoc {
  name: string; // 예: 용인교육지원청
  region: string;
  department?: string; // 담당부서 (예: 문화복지위원회, 교육경비보조금 담당과)
  contactName?: string;
  phone?: string;
  email?: string;
  note?: string;
}

/** educationOffices/{id}/visits - 방문기록/자료발송/미팅일정 통합 */
export type EduOfficeEventType = "visit" | "material_sent" | "meeting";

export interface EduOfficeEventDoc extends BaseDoc {
  type: EduOfficeEventType;
  scheduledAt: Timestamp | null;
  summary: string;
  authorUid: string;
  authorName: string;
}

// ----------------------------------------------------------------------------
// 4. partners (지역 파트너 / 영업 파트너)
// ----------------------------------------------------------------------------
export interface PartnerDoc extends BaseDoc {
  name: string;
  region: string;
  zone: "공동권역" | "신규권역" | "사촌권역"; // 파트너 담당권역 라벨 (2026.07부터 수수료 계산에는 더 이상 쓰이지 않음, lib/commission.ts 참고)
  phone?: string;
  email?: string;
  referralCount: number; // 소개건수 (집계값, contracts 생성/삭제 시 갱신)
  contractCount: number; // 계약건수 (집계값)
  totalRevenue: number; // 매출 누계 (집계값)
  totalCommission: number; // 수수료 누계 (집계값)
  note?: string;
  active: boolean;
}

// ----------------------------------------------------------------------------
// 5. cases (구축사례)
// ----------------------------------------------------------------------------
export interface CaseDoc extends BaseDoc {
  schoolName: string;
  schoolId?: string; // schools 참조 (있는 경우)
  region: string;
  installYear: number;
  photos: string[]; // Storage URL 배열
  review?: string;
  fileUrls: string[]; // PDF 등 첨부
  published: boolean; // 대외 자료로 공개할지 여부
}

// ----------------------------------------------------------------------------
// 6. contracts (계약관리) — 수익 자동계산의 기준 문서
// ----------------------------------------------------------------------------
export type SettlementStatus = "정산대기" | "정산중" | "정산완료";
/** @deprecated 실제 수수료 규정(2026.07)으로 교체되어 더 이상 수수료 계산에 쓰이지 않음. 파트너 담당권역 표시용으로만 남겨둠. */
export type CommissionZone = "공동권역" | "신규권역" | "사촌권역";

export type SchoolPassProduct = "zero_pass" | "school_pass";
/** 방식1: 단위 수량 판매(누적 집계) / 방식2: 사업 예산 방식(건별, 비누적) */
export type CommissionCalcMethod = "unit" | "project";

/** 계약금액 기준 수수료 자동계산 결과 (lib/commission.ts 참고, 2026.07 공식 수수료 규정 기준) */
export interface CommissionBreakdown {
  method: CommissionCalcMethod;
  product: SchoolPassProduct;
  unitCount?: number; // method가 "unit"일 때만 사용
  dealAmount: number; // 이 계약의 총 금액(부가세 포함 기준)
  tierBreakdown?: { units: number; rate: number; amount: number }[]; // unit 방식일 때 구간별 내역
  appliedRate?: number; // project 방식일 때 적용된 단일 요율
  totalCommission: number; // 최종 수수료 합계
}

export interface ContractDoc extends BaseDoc {
  schoolId: string;
  schoolName: string; // 비정규화
  region: string; // 비정규화 (통계용)
  contractAmount: number; // 계약금액
  installAmount?: number; // 설치금액
  installDate: Timestamp | null;
  contractDate: Timestamp | null;
  salesOwnerUid: string; // 영업담당
  salesOwnerName: string;
  partnerId?: string; // 지역파트너
  partnerName?: string;
  product: SchoolPassProduct;
  calcMethod: CommissionCalcMethod;
  unitCount?: number; // calcMethod가 "unit"일 때 판매 대수
  commission: CommissionBreakdown; // 자동계산 스냅샷 (계약금액 변경 시 재계산 후 저장)
  settlementStatus: SettlementStatus;
  note?: string;
}

// ----------------------------------------------------------------------------
// 7. schedules (일정관리: 방문/시연 예약 + 알림)
// ----------------------------------------------------------------------------
export type ScheduleType = "visit" | "demo" | "meeting" | "call" | "etc";

export interface ScheduleDoc extends BaseDoc {
  type: ScheduleType;
  title: string;
  schoolId?: string;
  schoolName?: string;
  eduOfficeId?: string;
  startAt: Timestamp;
  endAt?: Timestamp | null;
  location?: string;
  assigneeUid: string;
  assigneeName: string;
  reminderMinutesBefore?: number;
  done: boolean;
}

// ----------------------------------------------------------------------------
// 8. auditLogs (선택: 상태변경/삭제 등 감사로그)
// ----------------------------------------------------------------------------
export interface AuditLogDoc extends BaseDoc {
  actorUid: string;
  actorName: string;
  action: string; // 예: "school.status_change"
  targetCollection: string;
  targetId: string;
  detail?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// 파이프라인 상태 (영업관리 칸반보드 컬럼 = SchoolStatus)
// ----------------------------------------------------------------------------
export const PIPELINE_STAGES: SchoolStatus[] = [
  "신규",
  "전화완료",
  "자료발송",
  "방문예정",
  "시연",
  "견적",
  "협의중",
  "계약",
  "설치완료",
];

export const PIPELINE_STAGE_LABELS: Record<SchoolStatus, string> = {
  신규: "신규",
  전화완료: "전화완료",
  자료발송: "자료발송",
  방문예정: "방문예정",
  시연: "시연",
  견적: "견적",
  협의중: "협의중",
  계약: "계약",
  설치완료: "설치완료",
  보류: "보류",
  실패: "실패",
};

// ----------------------------------------------------------------------------
// 관공서(제로패스 타겟) — 학교와 완전히 별개 컬렉션.
// 학교(수만 건, summary/detail 분리·페이지네이션 필수)와 달리 전국 시/군/구 본청
// 수준(226곳 안팎)이라 규모가 훨씬 작아 단일 컬렉션으로 충분하다.
// 파이프라인 상태(SchoolStatus)·등급(SchoolGrade)은 그대로 재사용한다.
// ----------------------------------------------------------------------------
export type InstitutionType =
  | "시청"
  | "군청"
  | "구청"
  | "소방서"
  | "경찰서"
  | "국방부·군기관"
  | "기타 공공기관"
  // --- SchoolPass 교육행정 계층 (2026.09 공통 CRM 엔진 확장으로 추가) ---
  | "교육부"
  | "교육청"
  | "교육지원청";

/** 교육행정 계층 여부 판별 헬퍼 (ZeroPass 관공서 타입과 구분할 때 사용) */
export const EDU_HIERARCHY_TYPES: InstitutionType[] = ["교육부", "교육청", "교육지원청"];
export type BudgetStatus = "미확인" | "예산없음" | "신규예산필요" | "예산검토" | "예산편성예정" | "예산확보" | "구매진행";
export type InterestLevel = "높음" | "보통" | "낮음";

export interface InstitutionDoc extends BaseDoc {
  name: string;
  type: InstitutionType;
  region: string; // 시/도
  address: string;
  lat?: number;
  lng?: number;
  phone?: string; // 대표전화
  department?: string; // 담당부서 (예: 총무과)
  // 학교의 담당자 개념과 동일 — 청사출입보안지침상 "시설관리책임자"/"보안담당관"이 보통 총무과 소속
  contactName?: string;
  contactTitle?: string; // 예: 총무과 주무관, 보안담당관
  contactPhone?: string;
  contactEmail?: string;
  status: SchoolStatus; // 파이프라인 상태 재사용
  grade: SchoolGrade; // 등급 재사용
  interestLevel?: InterestLevel; // 관심도
  firstContactedAt?: Timestamp | null; // 최초 접촉일
  lastContactedAt?: Timestamp | null; // 최근 접촉일
  nextContactDueAt?: Timestamp | null; // 다음 접촉 예정일
  expectedAdoptionPeriod?: string; // 예상 도입 시기 (자유 입력, 예: "2026년 3분기")
  // --- 예산 CRM (간이 버전) ---
  budgetStatus?: BudgetStatus;
  budgetDepartment?: string; // 예산 담당부서
  budgetContactName?: string; // 예산 담당자
  expectedProjectAmount?: number; // 예상 사업금액
  expectedContractAmount?: number; // 예상 계약금액
  ownerUid?: string;
  ownerName?: string;
  tags: string[];
  note?: string;
  // --- 기관 계층 구조 (교육부→교육청→교육지원청→학교 / 향후 국방부→각군→사령부→부대 확장용) ---
  parentInstitutionId?: string; // 상위기관 참조 (institutions/{id}), 최상위 기관은 미설정
  ancestorPath?: string[]; // 루트부터 직속 상위까지의 id 배열 (breadcrumb·하위전체조회용 비정규화 캐시)
  childCount?: number; // 하위기관 수 (목록에서 "하위 3곳" 배지 표시용 비정규화 캐시)
}

// ----------------------------------------------------------------------------
// institutions/{id}/contacts — 담당자 다중관리 (기관:담당자 = 1:N)
// 기존 InstitutionDoc.contactName 등 단일 담당자 필드는 "대표 담당자" 표시용으로 계속 유지하고,
// 이 서브컬렉션은 실제 담당자 이력 전체를 보존한다 (담당자 교체 시에도 기존 이력 삭제하지 않음).
// ----------------------------------------------------------------------------
export type ContactReaction = "긍정적" | "중립" | "부정적" | "무반응" | "미확인";

export interface InstitutionContactDoc extends BaseDoc {
  name: string;
  department?: string; // 부서
  title?: string; // 직책
  phone?: string;
  email?: string;
  responsibility?: string; // 담당업무
  isFieldContact?: boolean; // 실무담당 여부
  isDecisionMaker?: boolean; // 의사결정 관련성
  firstContactedAt?: Timestamp | null;
  lastContactedAt?: Timestamp | null;
  contactCount?: number; // 접촉 횟수 (활동기록 생성 시 자동 증가)
  reaction?: ContactReaction;
  interestLevel?: InterestLevel;
  active?: boolean; // false = 퇴사/교체 등으로 더 이상 유효하지 않은 담당자 (삭제 대신 비활성화)
  note?: string;
}

// ----------------------------------------------------------------------------
// institutions/{id}/activities — 접촉 타임라인 (기존 addInstitutionActivity가 쓰던 느슨한
// 스키마를 공식 타입으로 정리. type 값은 스펙 8번 접촉방법 전체를 포괄하도록 확장.
// ----------------------------------------------------------------------------
export type InstitutionContactMethod =
  | "call"
  | "visit"
  | "email"
  | "sms"
  | "kakao"
  | "online_meeting"
  | "demo"
  | "document"
  | "etc";

export interface InstitutionActivityDoc extends BaseDoc {
  type: InstitutionContactMethod;
  contactId?: string; // institutions/{id}/contacts 참조 (누구와 접촉했는지)
  summary: string;
  reaction?: ContactReaction;
  requestedItems?: string; // 상대방 요청사항
  deliveredMaterials?: string; // 전달자료
  nextActionAt?: Timestamp | null;
  nextActionSummary?: string;
  authorUid: string;
  authorName: string;
}

// ----------------------------------------------------------------------------
// institutions/{id}/documents — 정책·공문 CRM (스펙 6번)
// AI는 이 기록을 근거로만 답하고 법률적 판단을 확정적으로 내리지 않는다 (프롬프트 레벨에서 강제).
// ----------------------------------------------------------------------------
export interface InstitutionDocumentDoc extends BaseDoc {
  relatedLaw?: string; // 관련 법령
  relatedPolicy?: string; // 관련 정책
  docTitle?: string; // 공문 제목
  issuingOrg?: string; // 공문 발행기관
  docDate?: Timestamp | null;
  relatedLink?: string;
  institutionResponded?: boolean; // 기관의 대응 여부
  contactReply?: string; // 담당자 답변
  followUp?: string; // 후속조치
}

// ----------------------------------------------------------------------------
// 공공영업 확장 파이프라인 (스펙 4번, 16단계) — 기존 SchoolStatus(9단계 학교 칸반)는
// 그대로 유지하고, 관공서/교육행정기관 전용 확장 파이프라인은 별도 타입으로 둔다.
// Phase 2에서 InstitutionDoc.status에 선택 적용 예정 (현재는 스키마만 정의, 미사용 — breaking change 방지).
// ----------------------------------------------------------------------------
export type PublicPipelineStage =
  | "조사"
  | "대상기관선정"
  | "담당부서확인"
  | "담당자확인"
  | "최초접촉"
  | "자료전달"
  | "미팅"
  | "제품시연"
  | "시범사업검토"
  | "내부검토"
  | "예산검토"
  | "조달검토"
  | "계약협의"
  | "계약완료"
  | "보류"
  | "종료";

export const PUBLIC_PIPELINE_STAGES: PublicPipelineStage[] = [
  "조사",
  "대상기관선정",
  "담당부서확인",
  "담당자확인",
  "최초접촉",
  "자료전달",
  "미팅",
  "제품시연",
  "시범사업검토",
  "내부검토",
  "예산검토",
  "조달검토",
  "계약협의",
  "계약완료",
];
