import { User } from "firebase/auth";
import { AiAction } from "@/lib/ai-prompts";

export interface AiGenerateResult {
  ok: boolean;
  action: AiAction;
  model: string;
  text: string;
  score: number | null;
}

export async function generateAi(user: User, schoolId: string, action: AiAction): Promise<AiGenerateResult> {
  const token = await user.getIdToken();
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ schoolId, action }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "AI 생성 실패");
  return json;
}
