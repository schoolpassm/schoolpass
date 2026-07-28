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
// 2. schools
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
  ownerUid?: string; // 담당자 uid
  ownerName?: string; // 담당자 이름 (비정규화, 목록 렌더링용)
  status: SchoolStatus; // 영업 파이프라인 상태 (칸반 컬럼과 동일 값)
  grade: SchoolGrade; // A/B/C/D 등급
  tags: string[];
  note?: string;
  partnerId?: string; // 연결된 지역 파트너
  isNewlyOpened?: boolean; // 신설 학교 여부 (여름방학 타겟용)
  archived?: boolean;
  // --- 학교알리미(NEIS) 자동 동기화 관련 ---
  neisSchoolCode?: string; // NEIS SD_SCHUL_CODE, 동기화 매칭 기준 키
  syncedFromNeis?: boolean; // NEIS 동기화로 생성된 레코드인지 여부
  lastSyncedAt?: Timestamp | null; // 마지막 NEIS 동기화 시각
  // --- AI 영업도구 ---
  aiScore?: number | null; // AI가 산정한 계약 가능성 점수 (0~100)
  aiScoreReason?: string; // 점수 산정 근거
  aiScoreUpdatedAt?: Timestamp | null;
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
