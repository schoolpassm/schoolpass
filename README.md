# Phase 3 — 기관 계층 UI + 담당자 다중관리 + 정책·공문 CRM

## 적용 방법

아래 7개 파일을 프로젝트의 같은 경로에 **덮어쓰기**(신규 3개는 그냥 추가)하시면 됩니다.

**덮어쓰기 (기존 파일 수정)**
- `app/institutions/[institutionId]/page.tsx`
- `app/institutions/page.tsx`
- `components/institutions/InstitutionFormModal.tsx`
- `lib/api/institutions.ts`

**신규 추가**
- `components/institutions/InstitutionHierarchyPanel.tsx`
- `components/institutions/InstitutionContactsPanel.tsx`
- `components/institutions/InstitutionDocumentsPanel.tsx`

올리신 뒤 GitHub push → Vercel 자동배포. Firestore rules/indexes는 이번엔 변경 없어서 따로 배포하실 것 없습니다 (Phase 1에서 이미 반영됨).

## 이번에 추가된 것

1. **기관 등록/수정 폼에 "상위기관" 선택 필드**
   - 이름으로 검색되는 드롭다운으로 다른 institutions 문서를 상위기관으로 지정
   - 기관 유형 목록에 교육부/교육청/교육지원청 추가
   - 상위기관을 바꾸면 `ancestorPath`가 자동 재계산되고, 이전/새 상위기관의 `childCount`도 같이 갱신됨
     (단, 이미 하위기관을 거느린 기관을 다시 옮기는 경우 그 하위기관들의 ancestorPath까지 cascade로
     갱신하지는 않습니다 — 실무에서는 말단 기관 재배치가 대부분이라 우선 이 정도로 두었고, 트리 중간
     노드를 대규모로 재편해야 하는 상황이 생기면 별도로 손봐야 합니다)

2. **기관 상세페이지에 계층 패널**
   - 상위기관 브레드크럼 (교육부 → 교육청 → 교육지원청 → ...)
   - 직속 하위기관 목록 (클릭하면 그 기관 상세로 이동)
   - 계층이 없는 일반 관공서(대부분의 ZeroPass 기관)에서는 이 패널 자체가 안 보입니다

3. **담당자 다중관리 패널** (스펙 7번)
   - 한 기관에 여러 담당자 등록 (이름/부서/직책/연락처/담당업무/실무담당·의사결정 여부/반응/관심도)
   - 담당자 교체 시 삭제 대신 "비활성화" — 이력은 접힌 목록에 남음
   - 전화/이메일 바로가기 버튼

4. **정책·공문 CRM 패널** (스펙 6번)
   - 관련 법령/정책/공문 제목/발행기관/날짜/링크/기관 대응 여부/담당자 답변/후속조치 기록
   - 화면에 "AI는 이 기록을 근거로만 답하고 법률적 판단을 확정하지 않는다"는 원칙 문구 표시

## 확인 사항

- `npx tsc --noEmit` 통과 확인 완료
- Phase 2에서 만드신 교육지원청 184곳 중 아무 곳이나 열어서 상위기관(예: 해당 교육청)을 지정해보고,
  학교 목록도 하위기관으로 보이는지 확인해보시면 좋습니다 (단, 학교는 `institutions` 컬렉션이
  아니라 `schools_*` 컬렉션이라 여기 하위기관 목록에는 안 뜹니다 — 이건 의도된 동작입니다.
  학교↔교육지원청 연결은 기존처럼 학교 쪽 `eduOfficeId`로 확인하시면 됩니다)

## 다음 단계 (아직 미착수)

- 확장 파이프라인(16단계) 적용, 14일 정체 알림 — Phase 4
- AI 공공영업비서에 계층/담당자/공문 정보 반영 — Phase 5
- 지도 기반 방문동선 제안 — Phase 6
