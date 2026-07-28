import { AiModel } from "@/lib/ai";

export type AiAction =
  | "call_script"
  | "email"
  | "sms"
  | "proposal"
  | "visit_log"
  | "score"
  | "nearby_cases";

export interface SchoolContext {
  name: string;
  region: string;
  level: string;
  studentCount?: number;
  status: string;
  grade: string;
  ownerName?: string;
  isNewlyOpened?: boolean;
  recentActivitySummaries: string[]; // 최근 활동기록 요약 (최대 5개 정도)
  nearbyCaseSummaries: string[]; // 같은 지역 구축사례 요약
}

/** 각 액션별로 어떤 모델을 쓸지 결정 (품질이 중요한 문서만 상위 모델) */
export function modelForAction(action: AiAction): AiModel {
  if (action === "proposal") return "claude-sonnet-5";
  return "claude-haiku-4-5-20251001";
}

const SYSTEM_PROMPT = `당신은 대한민국 학교 출입통제 시스템 "스쿨패스(SchoolPass)"의 B2G 영업을 지원하는 AI 어시스턴트입니다.
정중하고 신뢰감 있는 존댓말을 사용하고, 과장되거나 근거 없는 주장은 하지 않습니다.
스쿨패스는 학교 방문객 출입관리 시스템으로, 학생 안전 강화와 행정 업무 효율화를 핵심 가치로 제시합니다.`;

function contextBlock(ctx: SchoolContext): string {
  return `[학교 정보]
- 학교명: ${ctx.name}
- 지역: ${ctx.region}
- 학교급: ${ctx.level}
- 학생수: ${ctx.studentCount ?? "정보없음"}명
- 영업 단계: ${ctx.status} (등급 ${ctx.grade})
- 담당자: ${ctx.ownerName ?? "미지정"}
- 신설 학교 여부: ${ctx.isNewlyOpened ? "예" : "아니오"}
${ctx.recentActivitySummaries.length ? `\n[최근 활동 이력]\n${ctx.recentActivitySummaries.map((s) => `- ${s}`).join("\n")}` : ""}
${ctx.nearbyCaseSummaries.length ? `\n[인근/유사 구축사례]\n${ctx.nearbyCaseSummaries.map((s) => `- ${s}`).join("\n")}` : ""}`;
}

export function buildPrompt(action: AiAction, ctx: SchoolContext): { system: string; prompt: string; maxTokens: number } {
  const base = contextBlock(ctx);

  switch (action) {
    case "call_script":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 학교 행정실에 첫 전화를 걸 때 사용할 통화 스크립트를 작성해줘.
- 인사 → 소개 → 방문 목적(스쿨패스 소개) → 담당자 연결 요청 → 마무리 순서로
- 실제 통화처럼 짧고 자연스러운 문장으로, 15초 안에 핵심이 전달되게
- 상대가 바쁘다고 할 때 대응 멘트도 1줄 포함`,
      };

    case "email":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 700,
        prompt: `${base}\n\n위 학교 행정실장님께 보낼 소개 이메일을 작성해줘.
- 제목 + 본문 형식
- 스쿨패스가 "우선구매대상 지능정보제품"으로 지정되어 나라장터 소액수의계약으로 경쟁입찰 없이 도입 가능하다는 점을 자연스럽게 언급
- 정중하되 부담스럽지 않은 톤, 400자 이내`,
      };

    case "sms":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 300,
        prompt: `${base}\n\n위 학교 담당자에게 보낼 문자메시지를 작성해줘. 80자 이내, 용건만 간단히, 통화 가능 시간을 여쭤보는 형태로.`,
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
        maxTokens: 400,
        prompt: `${base}\n\n위 정보를 바탕으로 이 학교의 계약 성사 가능성을 0~100점으로 평가해줘.
반드시 아래 형식을 정확히 지켜서 답변:
점수: [숫자]
근거: [2~3문장으로 근거 설명]
다음 액션 제안: [1문장]`,
      };

    case "nearby_cases":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n위 인근/유사 구축사례 목록을 참고해서, 이 학교 영업 시 어떤 사례를 레퍼런스로 언급하면 좋을지, 그리고 왜 설득력 있을지 짧게 정리해줘. 구축사례가 없다면 그 지역에 아직 사례가 없다는 점을 어떻게 긍정적으로(예: "선도 도입 기회") 포지셔닝할지 제안해줘.`,
      };

    case "proposal":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 1400,
        prompt: `${base}\n\n위 학교에 제출할 스쿨패스 제안서 본문을 작성해줘. 아래 섹션 구조를 따라줘:
1. 제안 배경 (학생 안전 이슈, 최근 정책 동향)
2. 스쿨패스 솔루션 소개 (출입통제 핵심 기능 3가지)
3. 도입 효과 (행정업무 경감, 안전 강화)
4. 도입 절차 (나라장터 소액수의계약으로 신속 도입 가능)
5. 문의처
각 섹션은 소제목과 함께 간결한 문단 또는 불릿으로 작성. 전체 분량은 A4 1장 내외 텍스트량으로.`,
      };
  }
}
