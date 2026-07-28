# SchoolPass 영업 CRM

전국 학교 대상 SchoolPass 영업 활동을 관리하는 통합 CRM.
학교 · 교육지원청 · 구축사례 · 파트너 · 계약을 하나의 시스템에서 관리합니다.

## 기술 스택
- Next.js 14 (App Router) + TypeScript
- TailwindCSS (Blue + White 관리자 테마)
- Firebase: Authentication, Cloud Firestore, Storage, Hosting
- recharts (차트), @hello-pangea/dnd (칸반 드래그앤드롭), xlsx (엑셀 업/다운로드)

## 시작하기

```bash
npm install
cp .env.example .env.local   # Firebase 프로젝트 설정값 입력
npm run dev
```

Firebase 설정:
```bash
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

최초 관리자 계정은 Firebase Console에서 Authentication으로 사용자를 만든 뒤,
Firestore `users/{uid}` 문서를 아래 형태로 직접 생성해야 합니다.
```json
{ "email": "you@schoolpass.co.kr", "name": "유명환", "role": "admin", "active": true }
```

## 폴더 구조

```
schoolpass-crm/
├─ app/                        # Next.js App Router 페이지
│  ├─ login/
│  ├─ page.tsx                 # 대시보드
│  ├─ schools/                 # 학교관리 (목록 + [schoolId] 상세)
│  ├─ education-offices/       # 교육지원청
│  ├─ sales/                   # 영업관리 (칸반보드)
│  ├─ partners/                # 파트너관리
│  ├─ cases/                   # 구축사례
│  ├─ contracts/                # 계약관리 (수익 자동계산)
│  ├─ schedule/                 # 일정관리
│  ├─ files/                    # 파일관리 (전사 공용)
│  ├─ stats/                    # 통계
│  └─ settings/                 # 관리자 (권한 관리)
├─ components/
│  ├─ layout/                  # Sidebar, Topbar, MobileNav, AppShell(인증가드)
│  ├─ ui/                       # Card, Badge, Button, Input, Modal, Tabs
│  ├─ dashboard/                 # StatCard, Charts, PipelineOverview
│  ├─ schools/                   # SchoolTable, FormModal, DetailHeader, ActivityTimeline, QuotesTab, FilesTab
│  ├─ sales/                     # KanbanBoard
│  ├─ contracts/                 # ContractFormModal(자동계산 미리보기), ContractTable
│  ├─ partners/, education-offices/, cases/, schedule/
├─ lib/
│  ├─ firebase.ts                # Firebase 초기화
│  ├─ auth-context.tsx           # 인증 컨텍스트 (권한 분리)
│  ├─ commission.ts              # 수익 자동계산 핵심 로직
│  ├─ excel.ts                   # 엑셀 업/다운로드
│  ├─ utils.ts                   # 공통 유틸 (전화/문자/메일/지도 링크 등)
│  ├─ api/                       # Firestore CRUD (schools, contracts, partners, cases, schedules, educationOffices)
│  └─ hooks/                     # useCollection, useFirestoreDoc (실시간 구독)
├─ types/index.ts                # 전체 데이터 모델 (Firestore 스키마 1:1 매핑)
├─ docs/firestore-schema.md       # ERD + 컬렉션 설계 상세 문서
├─ firestore.rules, firestore.indexes.json, storage.rules, firebase.json
```

## 핵심 기능 매핑

| 메뉴 | 구현 위치 |
|---|---|
| 대시보드 (카드형 통계, 지역/월별 그래프, 파이프라인) | `app/page.tsx` |
| 학교관리 (등록/검색/필터/엑셀 업다운로드) | `app/schools/page.tsx` |
| 학교 상세 (전화/이메일/문자/방문기록, 견적, 첨부파일) | `app/schools/[schoolId]/page.tsx` |
| 교육지원청 (방문기록/자료발송/미팅일정) | `app/education-offices/page.tsx` |
| 영업관리 칸반보드 (드래그앤드롭 9단계) | `app/sales/page.tsx` |
| 파트너관리 (소개/계약/매출/수수료) | `app/partners/page.tsx` |
| 구축사례 (사진/후기/PDF) | `app/cases/page.tsx` |
| 계약관리 + 수익 자동계산 | `app/contracts/page.tsx`, `lib/commission.ts` |
| 일정관리 (방문/시연 예약) | `app/schedule/page.tsx` |
| 파일관리 (브로슈어/제안서/사진/PDF) | `app/files/page.tsx` |
| 통계 (지역/학교/파트너/월별/누적) | `app/stats/page.tsx` |
| 로그인/권한분리 (admin/manager/partner) | `lib/auth-context.tsx`, `firestore.rules` |
| 학교 클릭 시 빠른 액션 (전화/메일/문자/지도/다운로드) | `components/schools/SchoolDetailHeader.tsx` |

## 수익 자동계산 규칙
기본수수료 35% → 권역별(공동/신규/사촌) 배분율에 따라 본인/사촌/영업/운영비로 자동 분배.
자세한 내용은 `docs/firestore-schema.md` §3, `lib/commission.ts` 참고.

## 남은 확장 포인트 (실제 운영 전 권장)
- Cloud Functions로 대시보드/통계 집계를 서버사이드 배치화 (현재는 클라이언트 실시간 집계)
- 학교알리미 CSV/NEIS API 연동으로 학교 마스터 데이터 자동 동기화
- 캘린더 그리드 UI(월간뷰) 및 FCM 푸시 알림 연동
- 계약서/전자결재 PDF 자동 생성
