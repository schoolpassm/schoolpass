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
  isNewlyOpened?: boolean; // 신설 학교 여부 (여름방학 타겟용)
  isClosed?: boolean; // 폐교 여부 (NEIS 동기화로 감지)
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
  studentCount?: number;
  ownerName?: string;
  partnerId?: string;
  eduOfficeId?: string;
  eduOfficeName?: string;
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
  zone: "공동권역" | "신규권역" | "사촌권역"; // 수수료 계산 기준 권역 타입
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
export type CommissionZone = "공동권역" | "신규권역" | "사촌권역";

/** 계약금액 기준 수수료 자동계산 결과 (lib/commission.ts 참고) */
export interface CommissionBreakdown {
  baseRate: number; // 기본수수료율 (0.35 고정)
  baseCommission: number; // 계약금액 * baseRate
  zone: CommissionZone;
  self: number; // 본인 배분액
  cousin: number; // 사촌 배분액
  sales: number; // 영업 배분액
  operation: number; // 운영비 배분액
  selfRate: number;
  cousinRate: number;
  salesRate: number;
  operationRate: number;
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
  zone: CommissionZone;
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
