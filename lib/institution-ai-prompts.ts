import { AiModel } from "@/lib/ai";

export type InstitutionAiAction = "call_script" | "email" | "sms" | "proposal" | "objection_handling" | "expected_questions" | "next_action";

export interface InstitutionContext {
  name: string;
  type: string;
  region: string;
  status: string;
  grade: string;
  ownerName?: string;
  contactName?: string;
  contactTitle?: string;
  daysSinceLastContact?: number | null;
  recentActivitySummaries: string[];
  // 다음 액션 추천 전용 — 실제 CRM 데이터만 사용, 근거 없이 추측하지 않음
  budgetStatus?: string;
  nextContactDueAt?: string | null; // "2026-09-20" 형식
  expectedAdoptionPeriod?: string;
  daysSinceStatusChange?: number | null; // 현재 영업단계에 머문 일수
}

export function modelForInstitutionAction(action: InstitutionAiAction): AiModel {
  if (action === "proposal") return "claude-sonnet-5";
  return "claude-haiku-4-5-20251001";
}

const SYSTEM_PROMPT = `당신은 대한민국 관공서 출입통제 시스템 "제로패스(ZERO-PASS)"의 B2G 영업을 지원하는 AI 어시스턴트입니다.
제로패스는 ㈜바른정보기술(VAREUN)이 개발한 제품으로, 학교 전용 버전인 "스쿨패스(School-PASS)"와 같은 회사·같은 기술 기반이지만
타겟 기관(공공기관·지자체·국방부 등)과 법적 근거가 학교용과 다릅니다.
정중하고 신뢰감 있는 존댓말을 사용하고, 과장되거나 근거 없는 주장은 하지 않습니다.

[제품/회사 공식 사실 — 필요할 때 인용 가능. 이 목록에 없는 세부 수치·사례는 지어내지 말 것]
- 법적 근거: 「청사출입보안지침」(행정안전부훈령)에 따라 관공서는 시설관리책임자·보안담당관을 두고 출입을 통제하도록 되어 있음. 이 역할은 보통 총무과(또는 청사관리과, 안전총괄과) 소속.
- 학교와 달리 관공서는 "수기 방문대장" 문제보다, 직원 전용 사무공간(백오피스)의 출입통제·보안 강화가 핵심 니즈. 민원창구(1층 등)처럼 누구나 드나드는 공간은 타겟이 아니며, 직원 집무공간이 별도로 분리된 기관(시/군/구 본청, 소방서, 경찰서, 국방부·군기관 등)이 적합 타겟.
- 인증: CSAP SaaS 국가인증(과기부·국정원·KISA), GS 1등급(TTA), BF인증, 우선구매대상 지능정보제품 — 나라장터 벤처나라(26045124)·디지털서비스몰(26314110) 등록으로 소액수의계약 가능.
- 기술: 전자서명법 8조 기반 모바일 인증(생체정보 수집 없음), AES-256 암호화, 모바일 공무원증 서비스 지원(국가사이버안보센터 승인, 2026.06), 개인정보 배상책임보험 1억원.
- 설치: LTE 내장, 5분 설치, 24/365 무인 운영. AI 열화상 발열감지 탑재.
- 실적: 김포시청 도시안전정보센터(국내 1호 공공기관 도입, 2026.01), 국가 AI 데이터센터(AICA, 2026.07). 삼성 에스원 공식 협력업체 등록(2026.05).
- 가격: 제로패스 공급가 18,700,000원(VAT포함, 1년 서비스 포함), 1년 이후 월 125,000원부터.

매우 중요: 위 [제품/회사 공식 사실]과 아래 제공되는 [관공서 정보]에 없는 통계나 사실을 절대로 지어내지 마세요. 정보가 부족하면 "정보 없음"이라고 솔직히 밝히세요.
학교용 스쿨패스 제안 문구(수기 방문대장, 개인정보보호법 과징금 등)를 관공서에 그대로 쓰지 마세요 — 근거가 다릅니다.`;

function buildContextBlock(ctx: InstitutionContext): string {
  return [
    `[관공서 정보]`,
    `- 기관명: ${ctx.name}`,
    `- 유형: ${ctx.type}`,
    `- 지역: ${ctx.region}`,
    `- 영업 단계: ${ctx.status} (등급 ${ctx.grade})`,
    `- 담당자: ${ctx.ownerName ?? "미지정"}`,
    ctx.contactName
      ? `- 관공서측 담당자: ${ctx.contactName}${ctx.contactTitle ? ` (${ctx.contactTitle})` : ""} — 호칭에 이 이름을 사용할 것`
      : `- 관공서측 담당자: 아직 파악 안 됨 (통화로 성함/부서 확인 필요, 보통 총무과)`,
    ctx.daysSinceLastContact != null ? `- 최근 접촉 경과: ${ctx.daysSinceLastContact}일 전` : `- 접촉 이력 없음`,
    ctx.daysSinceStatusChange != null ? `- 현재 "${ctx.status}" 단계에 머문 기간: ${ctx.daysSinceStatusChange}일` : "",
    ctx.budgetStatus ? `- 예산 상태: ${ctx.budgetStatus}` : "",
    ctx.nextContactDueAt ? `- 다음 접촉 예정일: ${ctx.nextContactDueAt}` : "",
    ctx.expectedAdoptionPeriod ? `- 예상 도입 시기: ${ctx.expectedAdoptionPeriod}` : "",
    ctx.recentActivitySummaries.length > 0 ? `- 최근 활동: ${ctx.recentActivitySummaries.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstitutionPrompt(
  action: InstitutionAiAction,
  ctx: InstitutionContext
): { system: string; prompt: string; maxTokens: number } {
  const base = buildContextBlock(ctx);

  switch (action) {
    case "call_script":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 관공서에 첫 전화를 걸 때 사용할 통화 스크립트를 작성해줘.
1) 인사+소개: "안녕하세요, ㈜바른정보기술 정보화사업부 부장 유명환입니다. 청사 출입관리 시스템 관련해서 간단한 질문 하나 드려도 될까요?"
2) 핵심 질문: "혹시 직원 전용 사무공간이나 청사 출입 관련해서, 총무과나 시설관리 담당하시는 분 연결 가능할까요?"
3) 담당자 연결됐을 때: 제품을 짧게 소개하고 자료 전달을 위한 방문 요청
4) 바쁘다고 할 때 대응 멘트 1줄
5) 이메일 주소를 먼저 요청하는 멘트는 넣지 말 것 (방문 약속이 목적)`,
      };

    case "email":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 관공서 총무과(또는 담당부서)에 보낼 소개 이메일을 작성해줘.
- 제목 + 본문 형식
- 관공서측 담당자 성함이 파악되어 있으면 호칭에 사용, 없으면 "총무과 담당자님께"로 시작
- 「청사출입보안지침」에 따른 시설관리책임자·보안담당관의 출입통제 의무를 정중하게 언급
- 우선구매대상 지능정보제품으로 나라장터 소액수의계약 가능하다는 점 언급
- 450자 이내`,
      };

    case "sms":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 300,
        prompt: `${base}\n\n위 관공서 담당자에게 보낼 문자메시지를 작성해줘. 80자 이내, 용건만 간단히, 통화 가능 시간을 여쭤보는 형태로.`,
      };

    case "expected_questions":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n이 관공서 담당자가 제로패스 도입 상담 중 물어볼 가능성이 높은 질문 5개를 예상해줘. 예산, 조달 절차, 설치기간, 기존 시스템 연동, 보안인증 등 실무적인 관점에서.`,
      };

    case "objection_handling":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 600,
        prompt: `${base}\n\n제로패스 영업 시 자주 나오는 반박/거절 사유 3가지와 대응 멘트를 작성해줘.
예: "예산이 없다"(→ 우선구매대상 지능정보제품 수의계약), "지금도 문제없다"(→ 청사출입보안지침상 시설관리책임자 의무 언급), "다른 업체도 알아보는 중"(→ CSAP SaaS 인증·실적 언급).
형식: [반박 사유] → [대응 멘트 2~3문장]`,
      };

    case "proposal":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 1600,
        prompt: `${base}\n\n위 관공서에 제출할 제로패스(ZERO-PASS) 제안서 본문을 작성해줘. 아래 구조로:
1. 제안 배경 (청사출입보안지침에 따른 출입통제 의무, 직원 전용 공간 보안 강화 필요성)
2. 제로패스 솔루션 소개 (모바일 인증, CSAP SaaS, 열화상 발열감지 등)
3. 도입 효과
4. 검증된 실적 (김포시청, AICA 등)
5. 도입 절차 및 비용 (우선구매대상 지능정보제품, 나라장터 소액수의계약, 공급가 18,700,000원부터)
6. 문의처
각 섹션 소제목과 함께 간결하게. A4 1~2장 분량.`,
      };

    case "next_action":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n위 [관공서 정보]만 근거로, 지금 이 기관에 대해 취해야 할 다음 액션 1~2가지를 제안해줘.
- 반드시 위 정보에 실제로 있는 사실(경과일수, 현재 단계, 예산상태, 다음접촉예정일 등)을 근거로 들 것. 정보가 부족하면 "정보 부족으로 판단 어려움"이라고 솔직히 말할 것.
- 단순히 "연락하세요"라고 하지 말고, 왜 지금 그 액션이 필요한지 근거를 1문장으로 같이 제시.
- 형식:
추천 액션: [액션]
근거: [위 정보 중 구체적 근거]`,
      };
  }
}
