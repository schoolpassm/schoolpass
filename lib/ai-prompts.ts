import { AiModel } from "@/lib/ai";

export type AiAction =
  | "call_script"
  | "email"
  | "sms"
  | "proposal"
  | "visit_log"
  | "score"
  | "nearby_cases"
  | "counseling_summary"
  | "expected_questions"
  | "objection_handling"
  | "selling_points";

/** 실제 데이터로 계산한 구축학교 이웃 후보 (AI가 근거로 인용할 재료) */
export interface InstalledNeighbor {
  name: string;
  distanceKm?: number;
  studentCount?: number;
  sameEduOffice: boolean;
  sameLevel: boolean;
}

export interface SchoolContext {
  name: string;
  region: string;
  level: string;
  studentCount?: number;
  classCount?: number;
  status: string;
  grade: string;
  ownerName?: string;
  contactName?: string; // 학교측 담당자 성함 (있으면 AI가 호칭에 활용)
  contactTitle?: string; // 담당자 직책
  isNewlyOpened?: boolean;
  hasKindergarten?: boolean;
  daysSinceLastContact?: number | null; // null=접촉기록 없음
  recentActivitySummaries: string[]; // 최근 활동기록 요약 (최대 5개 정도)
  nearbyCaseSummaries: string[]; // 같은 지역 구축사례(구축완료 후기) 요약
  installedNeighbors: InstalledNeighbor[]; // 실제 쿼리로 찾은 인근/유사 구축학교 (거짓 데이터 절대 생성 금지, 이 목록만 근거로 사용)
  /** 서버에서 실제 데이터로 미리 계산해둔 가점/감점 요인. AI는 이 목록에 없는 근거를 지어내면 안 된다. */
  computedFactors: { label: string; positive: boolean }[];
  /** score 액션 전용: 코드가 고정 가중치 표로 미리 계산해둔 최종 점수(0~100). AI는 이 숫자를 그대로 설명만 하고 다른 숫자를 새로 만들면 안 된다. */
  weightedScore?: number;
}

/** 각 액션별로 어떤 모델을 쓸지 결정 (품질이 중요한 문서만 상위 모델) */
export function modelForAction(action: AiAction): AiModel {
  if (action === "proposal") return "claude-sonnet-5";
  return "claude-haiku-4-5-20251001";
}

const SYSTEM_PROMPT = `당신은 대한민국 학교 출입통제 시스템 "스쿨패스(SchoolPass, School-PASS)"의 B2G 영업을 지원하는 AI 어시스턴트입니다.
스쿨패스는 ㈜바른정보기술(VAREUN)이 개발한 제품으로, "제로패스(ZERO-PASS)"의 학교 전용 버전입니다.
영업 담당자는 ㈜바른정보기술 정보화사업부 부장 유명환이며, 학교에 처음 연락할 때 이 소속과 직함으로 본인을 소개합니다.
정중하고 신뢰감 있는 존댓말을 사용하고, 과장되거나 근거 없는 주장은 하지 않습니다.

[제품/회사 공식 사실 — 아래 정보는 검증된 사실이므로 필요할 때 인용 가능. 단, 이 목록에 없는 세부 수치·사례는 지어내지 말 것]
- 배경: 「개인정보 보호법」 개정안이 2026.2.12 국회 통과, 2026.9.11부터 전면 시행. 기관장(학교장)이 개인정보보호 최종 책임자로 명문화되고, 유출 통지 의무가 "사실"에서 "가능성 인지 시점"으로 강화됨. 과징금 상한(매출액 최대 10%, 50억원)은 재위반·고의중과실 대규모피해·시정조치 불이행 등 특정 중대 위반에만 적용되는 것으로, "모든 학교가 무조건 과징금을 낸다"는 식으로 단정해서 말하지 말 것 — 공립학교는 매출액 개념 자체가 없어 이 조항이 기업처럼 그대로 적용되는지도 불분명함. 예산·설비 등 보호에 선제적으로 투자하면 과징금 감경 사유로 인정되는 점, 그리고 기관장 책임 명문화·통지의무 강화는 확인된 사실이므로 이 부분 위주로 안내할 것.
- 문제의식: 수기 방문대장은 앞사람 개인정보(성명·연락처)가 뒷사람에게 그대로 노출되고, 법정 보존·파기 관리가 불가능해 개정법상 "유출 가능성" 상시 존재 상태.
- 제품 인증: 출입관리 키오스크 부문 CSAP SaaS 국가 인증(과기부·국정원·KISA), GS 1등급(TTA), BF(배리어프리) 인증(한국장애인개발원), 우선구매대상 지능정보제품 지정 — 나라장터 벤처나라(식별번호 26045124)·디지털서비스몰(26314110) 등록으로 소액수의계약(경쟁입찰 없이) 도입 가능.
- 보안 기술: 네이버·카카오·PASS 등 전자서명법 8조 기반 모바일 인증(생체정보 수집 없이 신원확인), AES-256 암호화 저장, 법정 보존기간 만료 시 자동 영구 삭제, 개인정보 배상책임보험 1억원(KB손해보험) 가입. 모바일 공무원증 서비스 지원(국가사이버안보센터 승인, 2026.06), 국가·공공기관 민간클라우드컴퓨팅서비스 제품 승인(국가사이버안보센터, 2026.06).
- 단독 계약: 네이버(주)와 스쿨패스 출입증(신원인증) 서비스 연계 단독 계약(전국 초중고교 대상, 2024.04), ㈜케이티와 'KT 보안인증 라우터' 단독 공급 계약(2024.12), 삼성 에스원 공식 협력업체 등록 및 공급 계약(2026.05).
- 설치: LTE 내장으로 통신·전기 공사 불필요, 5분 이내 설치, 24/365 무인 자동화 운영.
- 실적: 출시 3개월 만에 전국 50여개 초중고교 및 서울·경기·인천·광주 등 8개 시도교육청 채택. 공공기관 국내 1호 도입은 김포시청 도시안전정보센터(2026.1), 국내 최대 규모 국가 AI 데이터센터(AICA, 2026.7)에도 도입.
- 수상: 2026 대한민국 리딩기업 공공기관 출입보안 부문 대상, 2025 K-에듀테크 우수상.
- 요금(School-PASS, 학교 전용, VAT 포함): 공급가 17,200,000원(1년 서비스 이용료+초기설정비 포함), 1년 이후 월 74,000원부터(월 방문자 1,000명 이하 기준, 초과 시 1,000명 단위로 20,000원 종량 과금).
- 부가기능: AI 열화상 발열 감지(보안·방역 통합), 친환경 라벨(폐지 발생 제로) 발급.

매우 중요: 위 [제품/회사 공식 사실]과 아래 제공되는 [학교 정보]·[실제 확인된 근거]에 없는 통계나 사실(예: 실제로 확인 안 된 학생수, 구축학교, 거리)을 절대로 지어내지 마세요. 정보가 부족하면 "정보 없음"이라고 솔직히 밝히세요.`;

function contextBlock(ctx: SchoolContext): string {
  const lines = [
    `[학교 정보]`,
    `- 학교명: ${ctx.name}`,
    `- 지역: ${ctx.region}`,
    `- 학교급: ${ctx.level}`,
    `- 학생수: ${ctx.studentCount ?? "정보없음"}명`,
    ctx.classCount != null ? `- 학급수: ${ctx.classCount}개` : null,
    `- 영업 단계: ${ctx.status} (등급 ${ctx.grade})`,
    `- 담당자: ${ctx.ownerName ?? "미지정"}`,
    ctx.contactName ? `- 학교측 담당자: ${ctx.contactName}${ctx.contactTitle ? ` (${ctx.contactTitle})` : ""} — 호칭에 이 이름을 사용할 것` : `- 학교측 담당자: 아직 파악 안 됨 (통화로 성함 확인 필요)`,
    `- 신설 학교 여부: ${ctx.isNewlyOpened ? "예" : "아니오"}`,
    ctx.hasKindergarten != null ? `- 병설유치원 운영: ${ctx.hasKindergarten ? "예" : "아니오"}` : null,
    ctx.daysSinceLastContact != null ? `- 최근 접촉: ${ctx.daysSinceLastContact}일 전` : `- 최근 접촉: 기록 없음`,
  ].filter(Boolean);

  if (ctx.computedFactors.length) {
    lines.push(`\n[실제 확인된 근거 — 이 목록에 있는 사실만 근거로 사용할 것]`);
    ctx.computedFactors.forEach((f) => lines.push(`- ${f.positive ? "(+)" : "(-)"} ${f.label}`));
  }
  if (ctx.recentActivitySummaries.length) {
    lines.push(`\n[최근 활동 이력]`);
    ctx.recentActivitySummaries.forEach((s) => lines.push(`- ${s}`));
  }
  if (ctx.nearbyCaseSummaries.length) {
    lines.push(`\n[같은 지역 구축사례 후기]`);
    ctx.nearbyCaseSummaries.forEach((s) => lines.push(`- ${s}`));
  }
  if (ctx.installedNeighbors.length) {
    lines.push(`\n[실제 검색된 인근/유사 구축학교]`);
    ctx.installedNeighbors.forEach((n) => {
      const parts = [n.name];
      if (n.distanceKm != null) parts.push(`${n.distanceKm.toFixed(1)}km`);
      if (n.studentCount != null) parts.push(`학생수 ${n.studentCount}명`);
      if (n.sameEduOffice) parts.push("같은 교육지원청");
      if (n.sameLevel) parts.push("같은 학교급");
      lines.push(`- ${parts.join(" · ")}`);
    });
  }

  return lines.join("\n");
}

export function buildPrompt(action: AiAction, ctx: SchoolContext): { system: string; prompt: string; maxTokens: number } {
  const base = contextBlock(ctx);

  switch (action) {
    case "call_script":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 학교 행정실에 첫 전화를 걸 때 사용할 통화 스크립트를 아래 확정된 형식 그대로 작성해줘 (구조와 톤을 반드시 유지, 학교명 등 세부사항만 이 학교에 맞게 자연스럽게 조정):

1) 인사+소개: "안녕하세요, ㈜바른정보기술 정보화사업부 부장 유명환입니다. 학교 외부인 출입관리·방문객 정보관리 시스템 관련해서 간단한 질문 하나 드려도 될까요?"
2) 핵심 질문(수기 여부 확인): "외부인 출입증 발급하실 때 방명록을 수기로 작성하고 계신가요?"
3) 수기 방명록 쓴다는 답변이 나왔을 때: "네, 그러시면 관련 자료 잠깐 전달드리고 싶은데, 제가 잠시 방문드려도 괜찮으실까요?"
4) 방문 승낙 시: "감사합니다! 언제쯤 방문드리면 편하실까요?"
5) 이미 다른 시스템 쓴다는 답변이 나왔을 때 대응 멘트 1개 추가
6) 바쁘다고 할 때 대응 멘트 1줄 포함
7) 이메일 주소나 개인 연락처를 먼저 요청하는 멘트는 절대 넣지 말 것 (이 통화의 목적은 방문 약속만 잡는 것)`,
      };

    case "email":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 학교 행정실장님께 보낼 소개 이메일을 작성해줘.
- 제목 + 본문 형식
- 학교측 담당자 성함이 파악되어 있으면 "OOO 행정실장님께" 처럼 실제 성함/직책으로 호칭하고, 파악 안 됐으면 "행정실 담당자님께"로 일반적으로 시작
- 2026.9.11 개인정보보호법 개정안 전면시행(기관장 책임 명문화, 과징금 최대 10%)으로 수기 방문대장의 법적 리스크가 커진다는 점을 시급성 있게, 하지만 겁주는 톤이 아니라 정중하게 언급
- 우선구매대상 지능정보제품 지정으로 나라장터 소액수의계약(경쟁입찰 없이) 도입 가능하다는 점도 자연스럽게 언급
- 정중하되 부담스럽지 않은 톤, 450자 이내`,
      };

    case "sms":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 300,
        prompt: `${base}\n\n위 학교 담당자에게 보낼 문자메시지를 작성해줘. 80자 이내, 용건만 간단히, 통화 가능 시간을 여쭤보는 형태로. 담당자 성함이 파악되어 있으면 자연스럽게 호칭에 포함해줘.`,
      };

    case "visit_log":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n방금 이 학교를 방문하고 왔다고 가정하고, CRM에 기록할 방문일지 초안을 작성해줘.
- 방문 목적, 만난 사람(가정), 논의 내용, 다음 액션 순서로 5줄 이내
- 실제 대화 내용은 모르니 일반적인 템플릿 형태로 작성하고, 담당자가 빈칸을 채워넣을 수 있게 [ ] 표시로 placeholder를 넣어줘`,
      };

    case "score":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n이 학교의 계약 성사 가능성 점수는 이미 ${ctx.weightedScore}점(고정된 가중치 계산식으로 산출됨)으로 확정되어 있습니다.
당신의 역할은 이 숫자를 다시 판단하는 것이 아니라, 왜 이 점수가 나왔는지를 위 [실제 확인된 근거] 목록만 사용해서 설명하는 것입니다.
근거 목록에 없는 이유는 절대 만들어내지 마세요.
반드시 아래 형식을 정확히 지켜서 답변 (점수 숫자는 반드시 ${ctx.weightedScore}으로 그대로 쓸 것):
점수: ${ctx.weightedScore}
근거:
- [근거1, 반드시 위 목록에서 인용]
- [근거2]
- [근거3, 있다면]
다음 액션 제안: [1문장]`,
      };

    case "nearby_cases":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n위 [실제 검색된 인근/유사 구축학교] 목록만 사용해서, 이 학교 영업 시 언급할 레퍼런스 문장을 만들어줘.
- 목록이 있다면: "귀 학교와 비슷한 규모의 [학교명]에서 현재 SchoolPASS를 운영 중입니다." 형태의 문장을 실제 목록의 학교명으로 만들고, 왜 설득력 있는지 1문장 덧붙여줘.
- 목록이 비어있다면 지어내지 말고, 그 지역에 아직 사례가 없다는 점을 "선도 도입 기회"로 포지셔닝하는 문장을 제안해줘.`,
      };

    case "counseling_summary":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n[최근 활동 이력]을 바탕으로 지금까지의 상담 진행 상황을 3~5줄로 요약해줘. 담당자가 이 학교 상황을 빠르게 파악할 수 있도록 핵심만 정리.`,
      };

    case "expected_questions":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n이 학교(${ctx.level}, ${ctx.status} 단계)의 행정실/교장선생님이 스쿨패스 도입 상담 중 물어볼 가능성이 높은 질문 5개를 예상해줘. 예산(가격), 개인정보보호법 개정안 관련 법적 의무, 설치기간, 기존 시스템과의 연동, 유지보수 등 실무적인 관점에서.`,
      };

    case "objection_handling":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 600,
        prompt: `${base}\n\n스쿨패스 영업 시 자주 나오는 반박/거절 사유 3가지와, 각각에 대한 반박 대응 멘트를 작성해줘.
예: "예산이 없다"(→ 우선구매대상 지능정보제품으로 수의계약 간소화, 선제투자 시 과징금 40% 감경 언급), "지금 시스템(수기 방문대장)으로 충분하다"(→ 2026.9.11 개정법 시행 시 기관장 책임·과징금 리스크 언급), "다른 업체도 알아보고 있다"(→ CSAP SaaS·BF 인증, 전국 50여개교 실적 언급) 같은 유형을 이 학교 상황에 맞게 조정해서.
형식: [반박 사유] → [대응 멘트 2~3문장]`,
      };

    case "selling_points":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n이 학교에 스쿨패스를 제안할 때 가장 강조하면 좋을 제안 포인트 3가지를 우선순위 순으로 정리해줘. [실제 확인된 근거]와 학교 특성(학교급, 신설여부 등), 그리고 개정 개인정보보호법 대응·인증 현황·실적을 반영해서 이 학교에 맞춤화된 포인트로.`,
      };

    case "proposal":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 1600,
        prompt: `${base}\n\n위 학교에 제출할 스쿨패스(School-PASS) 제안서 본문을 작성해줘. 아래 섹션 구조를 따라줘:
1. 제안 배경 (2026.9.11 개인정보보호법 개정안 전면시행 — 기관장 책임 명문화, 과징금 최대 10%/50억원 — 과 수기 방문대장의 법적 리스크)
2. 스쿨패스 솔루션 소개 (모바일 신원인증, CSAP SaaS 인증 클라우드+AES-256 암호화, 자동 파기, 열화상 발열감지 등 핵심 기능)
3. 도입 효과 (법적 리스크 사전 예방, 행정업무 경감, 학생 안전 강화)
4. 검증된 실적 (전국 50여개 초중고교·8개 시도교육청 채택, GS 1등급·BF 인증)
5. 도입 절차 및 비용 (우선구매대상 지능정보제품으로 나라장터 소액수의계약 가능, School-PASS 공급가 17,200,000원부터)
6. 문의처
각 섹션은 소제목과 함께 간결한 문단 또는 불릿으로 작성. 전체 분량은 A4 1~2장 내외 텍스트량으로.`,
      };
  }
}
