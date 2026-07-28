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
  isNewlyOpened?: boolean;
  hasKindergarten?: boolean;
  daysSinceLastContact?: number | null; // null=접촉기록 없음
  recentActivitySummaries: string[]; // 최근 활동기록 요약 (최대 5개 정도)
  nearbyCaseSummaries: string[]; // 같은 지역 구축사례(구축완료 후기) 요약
  installedNeighbors: InstalledNeighbor[]; // 실제 쿼리로 찾은 인근/유사 구축학교 (거짓 데이터 절대 생성 금지, 이 목록만 근거로 사용)
  /** 서버에서 실제 데이터로 미리 계산해둔 가점/감점 요인. AI는 이 목록에 없는 근거를 지어내면 안 된다. */
  computedFactors: { label: string; positive: boolean }[];
}

/** 각 액션별로 어떤 모델을 쓸지 결정 (품질이 중요한 문서만 상위 모델) */
export function modelForAction(action: AiAction): AiModel {
  if (action === "proposal") return "claude-sonnet-5";
  return "claude-haiku-4-5-20251001";
}

const SYSTEM_PROMPT = `당신은 대한민국 학교 출입통제 시스템 "스쿨패스(SchoolPass)"의 B2G 영업을 지원하는 AI 어시스턴트입니다.
정중하고 신뢰감 있는 존댓말을 사용하고, 과장되거나 근거 없는 주장은 하지 않습니다.
스쿨패스는 학교 방문객 출입관리 시스템으로, 학생 안전 강화와 행정 업무 효율화를 핵심 가치로 제시합니다.
매우 중요: 제공된 [학교 정보]와 [실제 확인된 근거]에 없는 통계나 사실(예: 실제로 확인 안 된 학생수, 구축학교, 거리)을 절대로 지어내지 마세요. 정보가 부족하면 "정보 없음"이라고 솔직히 밝히세요.`;

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
        maxTokens: 500,
        prompt: `${base}\n\n위 [실제 확인된 근거] 목록만 사용해서 이 학교의 계약 성사 가능성을 0~100점으로 평가해줘.
근거 목록에 없는 이유는 절대 만들어내지 마세요. 근거가 부족하면 점수를 보수적으로 낮게 매기세요.
반드시 아래 형식을 정확히 지켜서 답변:
점수: [숫자]
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
        prompt: `${base}\n\n이 학교(${ctx.level}, ${ctx.status} 단계)의 행정실/교장선생님이 스쿨패스 도입 상담 중 물어볼 가능성이 높은 질문 5개를 예상해줘. 예산, 설치기간, 기존 시스템과의 연동, 유지보수 등 실무적인 관점에서.`,
      };

    case "objection_handling":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 600,
        prompt: `${base}\n\n스쿨패스 영업 시 자주 나오는 반박/거절 사유 3가지와, 각각에 대한 반박 대응 멘트를 작성해줘.
예: "예산이 없다", "지금 시스템으로 충분하다", "다른 업체도 알아보고 있다" 같은 유형을 이 학교 상황에 맞게 조정해서.
형식: [반박 사유] → [대응 멘트 2~3문장]`,
      };

    case "selling_points":
      return {
        system: SYSTEM_PROMPT,
        maxTokens: 500,
        prompt: `${base}\n\n이 학교에 스쿨패스를 제안할 때 가장 강조하면 좋을 제안 포인트 3가지를 우선순위 순으로 정리해줘. [실제 확인된 근거]와 학교 특성(학교급, 신설여부 등)을 반영해서 이 학교에 맞춤화된 포인트로.`,
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
