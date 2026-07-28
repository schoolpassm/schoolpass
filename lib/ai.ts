/**
 * Anthropic Claude API 서버 전용 클라이언트.
 * 절대 클라이언트 컴포넌트에서 import 하지 말 것 — API 키가 노출된다.
 * ANTHROPIC_API_KEY 환경변수 필요 (console.anthropic.com 에서 발급, 종량제).
 */

export type AiModel = "claude-haiku-4-5-20251001" | "claude-sonnet-5";

interface CallClaudeOptions {
  model?: AiModel;
  maxTokens?: number;
  system?: string;
}

export async function callClaude(prompt: string, options: CallClaudeOptions = {}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. console.anthropic.com 에서 발급받아 등록하세요.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model ?? "claude-haiku-4-5-20251001", // 기본값: 저렴한 모델
      max_tokens: options.maxTokens ?? 1024,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API 호출 실패 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const textBlocks = (json.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text);
  return textBlocks.join("\n").trim();
}
