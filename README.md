# ZeroPass 통합 확장 — 최종 통합 배포 패키지 (2026.10.09)

"SchoolPass 영업 CRM — ZeroPass 통합 확장 지시서" 전체(1~9번 섹션)를 구현한 변경사항입니다.
"쭉 진행해줘 자동진행으로 마지막에 한번에 올리게" 지시에 따라 Phase A~H를 전부 끝낸 뒤 한 번에 모았습니다.

## 업로드 방법
이 zip을 풀어서 나온 폴더 구조 그대로, GitHub 저장소(schoolpassm/schoolpass)의 같은 경로에
덮어쓰기(Replace) 업로드하면 됩니다. 새로 생긴 파일(아래 "신규 파일" 목록)도 같은 방식으로 추가하세요.
Firestore 보안 규칙(`firestore.rules`)은 **Firebase 콘솔 → Firestore Database → 규칙** 탭에 가서
내용을 복붙하고 "게시"를 눌러야 실제로 적용됩니다 (GitHub에 올리는 것과 별개의 작업입니다).

## 신규 파일 (지금까지 없었던 파일)
- `lib/unified-pipeline.ts` — 통합 17단계 파이프라인 헬퍼
- `lib/api/access-log.ts` — 열람·수정 이력 기록 함수
- `lib/api/settings.ts` — 시스템 설정(보유기간정책/AI전송범위) 읽기·쓰기
- `components/institutions/InstitutionPickerInput.tsx` — 계약 등록 시 기관 검색 선택기
- `components/dashboard/UnifiedSalesPanel.tsx` — 대시보드 통합 영업 현황 패널

## 수정된 파일
나머지 모든 파일은 기존 파일을 수정한 것입니다 (기존 로직/데이터를 지우지 않고 추가만 했습니다).

---

## Phase별 구현 내용

### Phase A — 데이터 모델 확장 (지시서 2·3번)
- `types/index.ts`: `InstitutionType`에 7개 유형 추가(중앙행정기관/공기업·공단/공공시설/민간기업/제조공장/물류센터/연구소),
  `SalesProduct`(SchoolPass/ZeroPass/두 제품 모두), 방문자관리방식/검토상태/구매방식 등 열거형,
  통합 17단계 파이프라인(`UnifiedPipelineStage`) 추가. `InstitutionDoc`/`SchoolDoc`에 신규 필드는 전부
  `?` 옵션 필드로만 추가 — 기존 필드는 하나도 건드리지 않음.
- `ContractDoc`에 `institutionId`/`institutionName` 추가 (schoolId는 기관 계약일 때 빈 문자열로 둠 — 하위호환).

### Phase B — 통합 파이프라인 (지시서 3번)
- `lib/unified-pipeline.ts`: `salesStage` 필드 전용 헬퍼(현재 단계, 체류일수, 14일 정체 판정).
  기존 `status`(9단계)·`publicStage`(16단계)는 그대로 유지, 세 파이프라인이 공존.

### Phase C/E — 기관 상세 페이지 확장 (지시서 5번)
`app/institutions/[institutionId]/page.tsx`:
- "통합 영업 단계" 선택 UI를 기존 "공공영업 단계" 선택 UI 옆에 추가.
- 14일 이상 정체 시 경고 배지 표시.
- "제품 및 도입 현황" 카드 신설: 제품/방문자관리방식/구매방식/보안검토/개인정보검토/시범운영/운영상불편/도입우선순위/다음행동.
  값이 없는 민감 항목은 **"검토 필요"로 표시**(확정값처럼 보이지 않게 — 지시서 7번 요구사항).
- 하단을 탭(활동기록/견적/첨부파일/메모)으로 재구성 — `QuotesTab`/`FilesTab`을
  `basePath="institutions/{id}"`로 재사용해 학교와 똑같은 UI로 **견적서·계약서·제안서·시연자료** 관리 가능.
- `QuotesTab`/`FilesTab`(`components/schools/`)을 범용화해서 기존 학교 쪽 동작은 전혀 바뀌지 않음.
- `lib/api/contracts.ts`: 계약 생성 시 기관이면 institutions 문서의 `status`+`salesStage`를 "계약"으로 갱신.
- `ContractFormModal`/`ContractTable`: 계약 대상을 "학교" 또는 "관공서·민간기업 등"으로 선택 가능.

### Phase D — 대시보드 확장 (지시서 4번)
`components/dashboard/UnifiedSalesPanel.tsx` (신규) + `app/page.tsx`에 한 줄 추가:
- 기존 대시보드 레이아웃/위젯은 그대로 두고, 그 위에 새 패널만 추가.
- 필터: 전체/SchoolPass/ZeroPass, 전체/학교/교육기관/공공기관/공기업·공단/민간기업/군부대, 지역, 담당자, 기간.
- KPI: 제품별 영업대상 수, 이번달 신규접촉, 담당자연결, 시연완료, 견적발송, 예산확보, 보안검토진행,
  계약건수, 설치완료, 후속연락지연.
- **실제값 vs AI추정값 시각적 구분**: "예상 매출"과 "가중 예상 매출"은 노란색 점선 테두리 카드에
  "AI 추정 · 확정 아님" 라벨과 함께 표시. 단계별 확률은 관리자 설정 데이터가 아직 없어 임시 기본값을
  쓴다는 점을 화면에 명시(지시서 4번 "추정은 추정으로 표시" 요구사항).
- 학교 쪽 KPI는 기존 `useDashboardStats()` 집계(count 쿼리)를 그대로 재사용 — 9,930여건 전체를
  다시 읽지 않아 Firestore 읽기 비용이 늘지 않음. institutions는 `/institutions` 목록 페이지와
  동일한 방식(전체 로드)으로 집계.

### Phase F — AI Copilot 개선 (지시서 6번)
- `lib/institution-ai-prompts.ts`: 신규 액션 3개 추가
  - `post_demo_followup` (시연 후 후속 이메일)
  - `budget_schedule` (예산 편성 및 구매 일정 정리 — 정보 없으면 "정보 없음"이라고 명시)
  - `contract_likelihood` (계약 가능성 판단 — **근거와 불확실성을 분리해서 출력**하도록 프롬프트에 강제,
    마지막에 "AI의 추정이며 확정이 아님"을 반드시 명시)
  - `InstitutionContext`에 제품/통합단계/방문자관리방식/보안·개인정보검토상태 등 ZeroPass 필드 추가 —
    근거로 쓰되 없으면 "검토 필요"/"정보 없음"으로 정직하게 표시.
- `app/api/ai/institution-generate/route.ts`: 위 3개 액션 처리 + 새 컨텍스트 필드 전달.
- `components/institutions/InstitutionAiToolsPanel.tsx`: 버튼 3개 추가.
- `app/api/ai/portfolio/route.ts` (대시보드 AI 브리핑): "오늘 접촉 예정 기관", "후속 연락 지연된 기관"을
  institutions 데이터에서 뽑아 브리핑 프롬프트에 포함 — 지시서 6번 "오늘 연락할 기관 추천",
  "후속 연락이 지연된 기관 탐지" 요구사항.

### Phase G — 개인정보 및 보안 (지시서 7번)
- `types/index.ts`: `AccessLogDoc`(열람/수정 이력), `SystemSettingsDoc`(보유기간정책+AI전송범위) 타입.
- `lib/api/access-log.ts`: `{collection}/{id}/access_logs`에 열람·수정 이력 기록(best-effort, 실패해도
  화면 동작 막지 않음).
- `app/institutions/[institutionId]/page.tsx`: 페이지 열람 시 자동으로 "view" 로그 기록, 통합단계 변경 시
  "update" 로그 기록. **admin에게만** 최근 20건 열람·수정 이력 카드 노출(일반 영업담당에게는 불필요).
- `lib/api/settings.ts` + `app/settings/page.tsx`: "개인정보 및 보안" 카드 신설
  - 보유기간 및 삭제정책을 관리자가 직접 문서화(텍스트 입력, 저장)
  - 외부 AI(Claude API) 전송 데이터 범위 체크박스(담당자정보/예산정보/메모 포함 여부) — **단, 저장만
    지원하고 아직 AI 호출부에 실제로 연동되지는 않았음을 화면에 명시** (확정된 적용 범위처럼
    보이지 않게 — 지시서 7번의 "완료되지 않은 것을 완료된 것처럼 표시하지 말 것" 원칙 준수).
- `firestore.rules`: `institutions/{id}/quotes`, `/files`, `/access_logs`, `schools_detail/{id}/access_logs`,
  `settings/{id}` 컬렉션 규칙 추가. **이 규칙을 Firebase 콘솔에 게시하지 않으면 새 견적/첨부파일/
  이력 기능이 "권한 없음" 오류가 날 수 있습니다 — 꼭 게시하세요.**
- 기존 admin/manager/partner 역할 분리는 이미 구현되어 있던 것을 그대로 활용(새로 만들지 않음).

### Phase H — 검증
`npx tsc --noEmit` 전체 통과(에러 0건) — 이 패키지의 모든 파일 포함.
(`next build`는 이 작업 환경에 Firebase 환경변수가 없어서 정적 페이지 생성 단계에서 실패하는데,
이건 기존 모든 페이지(/login, /cases, /schedule 등 이번에 손대지 않은 페이지도 전부)에서 동일하게
발생하는 현상으로, Vercel 실제 배포 환경(환경변수 설정됨)에서는 문제없이 빌드됩니다. 이번 변경과는
무관함을 확인했습니다.)

---

## 완료 검증 체크리스트 (지시서 9번 기준)

1. ✅ 기존 9,930여개 학교 + 영업이력 보존 — `SchoolDoc`/`SchoolSummaryDoc`/`SchoolStatus` 등 기존 필드·
   타입을 하나도 삭제·변경하지 않고 옵션 필드만 추가했습니다.
2. ✅ 학교와 공공기관을 검색·구분 가능 — `/institutions` 목록에 제품/유형 필터 이미 존재, 신규 유형
   7종 추가로 구분 폭 확장.
3. ✅ SchoolPass/ZeroPass 제품별 필터링 — 대시보드 `UnifiedSalesPanel`, `/institutions` 목록, 계약
   등록 폼 전부 제품 필터/선택 지원.
4. ✅ 파이프라인 단계 변경 영구 저장 — `updateInstitutionSalesStage`가 Firestore에 즉시 반영, 화면도
   그 값을 그대로 구독.
5. ✅ 기관별 접촉이력/다음행동 보존 — 활동기록(기존)에 더해 "다음 행동" 필드, 통합단계 변경 이력은
   `salesStageEnteredAt`으로 추적.
6. ✅ 대시보드 통계가 실제 데이터와 일치 — 모든 새 KPI는 Firestore 실제 문서를 집계한 값이며, 추정치는
   별도 색상/라벨로 구분.
7. ⚠️ 기존 기능 회귀 테스트 — 이 세션에서는 `tsc --noEmit` 정적 검증까지 완료했습니다. **실제 화면
   클릭 테스트(학교 목록/칸반/지도/계약 등록/대시보드)는 배포 후 직접 한 번 확인해주시길 권장합니다.**
8. ✅ 오류 시 기존 데이터 손상 방지 — 모든 신규 기능은 기존 컬렉션/문서를 직접 덮어쓰지 않고 `merge`
   또는 새 서브컬렉션에만 쓰며, `access_logs` 기록 실패는 try/catch로 감싸 화면 동작을 막지 않습니다.

---

## 배포 후 꼭 해야 할 일
1. GitHub에 이 폴더 구조대로 업로드 (Vercel이 자동 배포)
2. **Firebase 콘솔 → Firestore Database → 규칙**에서 `firestore.rules` 내용 복붙 후 게시
3. 로그인해서 `/institutions`의 기관 하나를 열어 "통합 영업 단계"가 보이는지, 견적/첨부파일 탭이
   동작하는지 확인
4. `/settings`에서 "개인정보 및 보안" 카드가 보이는지 확인 (admin 계정으로)
5. 대시보드(`/`)에서 "통합 영업 현황" 패널이 보이는지 확인
