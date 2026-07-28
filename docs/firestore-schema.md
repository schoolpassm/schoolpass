# SchoolPass CRM — Firestore 스키마 설계

## 1. ERD (개념도)

```
users (uid=docId)
  └─ role: admin | manager | partner
  └─ partnerId ──────────────┐
                              │
schools                       │
  ├─ eduOfficeId ──> educationOffices
  ├─ partnerId ─────> partners  <──────────┘
  ├─ ownerUid ──────> users
  ├─ /activities   (전화·이메일·문자·방문·메모·상태변경 로그)
  ├─ /quotes       (견적 이력)
  └─ /files        (브로슈어·사진·제안서 첨부)

educationOffices
  └─ /events        (방문기록·자료발송·미팅일정)

partners
  └─ (contracts.partnerId 로 역참조, 집계필드 보유)

contracts
  ├─ schoolId ──────> schools        (1 school : N contracts, 통상 1:1)
  ├─ partnerId ─────> partners
  ├─ salesOwnerUid ─> users
  └─ commission: CommissionBreakdown (계산 스냅샷, 재계산 금지 — 계약 당시 값 보존)

cases (구축사례)
  └─ schoolId ──────> schools (optional, 스냅샷 필드 위주)

schedules (일정)
  ├─ schoolId ──────> schools (optional)
  └─ assigneeUid ───> users

files (전사 공용 파일함) — schools/{id}/files 와 별도의 최상위 컬렉션

auditLogs — 감사로그 (선택)
```

### 관계 요약
| 관계 | 카디널리티 | 비고 |
|---|---|---|
| users – schools | 1 : N | ownerUid로 담당자 지정 |
| users(partner) – partners | 1 : 1 | partner 역할 유저는 partnerId로 자기 파트너 문서에 매핑 |
| educationOffices – schools | 1 : N | 학교의 eduOfficeId로 참조 |
| partners – schools | 1 : N | 파트너의 담당 권역 학교 |
| partners – contracts | 1 : N | 계약 성사 시 파트너 실적 집계 갱신 |
| schools – contracts | 1 : N (통상 1:1) | 학교 계약 성사 시 생성 |
| schools – activities/quotes/files | 1 : N | 서브컬렉션 |

---

## 2. Collection 설계

### `users/{uid}`
Firebase Auth uid를 문서ID로 사용.
| 필드 | 타입 | 설명 |
|---|---|---|
| email, name | string | |
| role | "admin" \| "manager" \| "partner" | 권한 분리 기준 |
| partnerId | string? | role=partner일 때 연결된 partners 문서 |
| region | string? | 담당 권역 |
| active | boolean | 비활성화 시 로그인은 되나 쓰기 차단 |

### `schools/{schoolId}`
학교 마스터 데이터. 목록/칸반/대시보드의 기준 컬렉션.
주요 필드: `name, region, district, level, address, lat, lng, phone, adminOfficePhone, email, eduOfficeId, studentCount, ownerUid, ownerName, status(파이프라인 9단계+보류/실패), grade(A~D), tags[], partnerId, isNewlyOpened, archived`

- **`schools/{id}/activities/{activityId}`**: 전화/이메일/문자/방문/메모/상태변경 통합 타임라인 (`type` 필드로 구분)
- **`schools/{id}/quotes/{quoteId}`**: 견적 이력 (`amount, itemSummary, status`)
- **`schools/{id}/files/{fileId}`**: Storage 메타데이터 (`category: brochure|photo|proposal|contract|etc`)

### `educationOffices/{officeId}`
`name, region, department, contactName, phone, email`
- **`/events/{eventId}`**: `type: visit|material_sent|meeting`

### `partners/{partnerId}`
`name, region, zone(공동권역|신규권역|사촌권역), referralCount, contractCount, totalRevenue, totalCommission(집계값, 계약 생성 시 트랜잭션으로 갱신)`

### `cases/{caseId}` (구축사례)
`schoolName, schoolId?, region, installYear, photos[], review, fileUrls[], published`

### `contracts/{contractId}`
계약 + 수익 자동계산의 기준 문서.
`schoolId, schoolName, region, contractAmount, installAmount, installDate, contractDate, salesOwnerUid, salesOwnerName, partnerId, partnerName, zone, commission(스냅샷), settlementStatus`

`commission` (CommissionBreakdown) 구조:
```ts
{
  baseRate: 0.35,
  baseCommission: number,   // 계약금액 * 0.35
  zone: "공동권역" | "신규권역" | "사촌권역",
  self, cousin, sales, operation: number,       // 권역별 배분액
  selfRate, cousinRate, salesRate, operationRate: number
}
```

### `schedules/{scheduleId}`
`type: visit|demo|meeting|call|etc, title, schoolId?, startAt, endAt?, location, assigneeUid, reminderMinutesBefore, done`

### `files/{fileId}` (전사 공용)
학교에 종속되지 않는 브로슈어/제안서/사진/PDF 보관함.

### `auditLogs/{logId}` (선택, 확장용)
`actorUid, action, targetCollection, targetId, detail`

---

## 3. 수익 자동계산 로직 (`lib/commission.ts`)

기본수수료 = 계약금액 × 35%. 권역별 배분율(계약금액 대비 %):

| 권역 | 본인 | 사촌 | 영업 | 운영비 | 합계 |
|---|---|---|---|---|---|
| 공동권역 | 10% | 10% | 10% | 5% | 35% |
| 신규권역 | 11% | 9% | 10% | 5% | 35% |
| 사촌권역 | 9% | 11% | 10% | 5% | 35% |

계약 등록 시 `calculateCommission(contractAmount, zone)` 결과가 `contracts.commission`에 **스냅샷으로 저장**되며, 이후 수수료 정책이 바뀌어도 과거 계약의 배분 내역은 보존된다.

---

## 4. Firestore 인덱스 (`firestore.indexes.json`)
- `schools`: (region, status, createdAt desc) / (partnerId, status) / (ownerUid, status, updatedAt desc)
- `contracts`: (partnerId, contractDate desc) / (settlementStatus, contractDate desc) / (region, contractDate desc)
- `schedules`: (assigneeUid, startAt) / (done, startAt)
- `activities` (collection group): (type, createdAt desc)

## 5. 보안 규칙 (`firestore.rules`, `storage.rules`)
- **admin**: 전체 CRUD, 사용자 권한 변경, 삭제 권한
- **manager**: 학교/교육지원청/파트너/계약/일정 CRUD (삭제는 admin 전용 항목 존재)
- **partner**: 자신에게 연결된 학교(`partnerId`)·계약·파트너 문서만 읽기 전용
- Storage는 로그인 사용자만 read/write, 학교당 20MB·구축사례 30MB 파일 크기 제한
