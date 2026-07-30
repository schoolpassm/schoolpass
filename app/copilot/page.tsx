"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SchoolPickerInput } from "@/components/schools/SchoolPickerInput";
import { useAuth } from "@/lib/auth-context";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "이번주 방문하면 좋을 학교 3곳 추천해줘",
  "지금 계약 가능성이 가장 높은 학교는 어디야?",
  "이 학교에 어떤 제안 포인트로 접근하면 좋을까?",
];

export default function CopilotPage() {
  const { firebaseUser } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string } | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend(question?: string) {
    const q = (question ?? input).trim();
    if (!q || !firebaseUser) return;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: q, schoolId: selectedSchool?.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI 응답 실패");
      setMessages((prev) => [...prev, { role: "assistant", text: json.text }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${e.message || "오류가 발생했습니다."}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="AI Copilot">
      <div className="mx-auto flex h-[calc(100vh-140px)] max-w-2xl flex-col">
        <Card className="mb-3 p-3">
          <p className="mb-1.5 text-xs font-medium text-ink-500">
            특정 학교로 범위를 좁히려면 검색해서 선택하세요 (비워두면 전체 포트폴리오 기준으로 답합니다)
          </p>
          <SchoolPickerInput
            value={selectedSchool}
            onSelect={(s) => setSelectedSchool(s ? { id: s.id, name: s.name } : null)}
            placeholder="학교명 검색 (선택 안 하면 전체 기준)"
          />
        </Card>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-surface-border bg-white p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Sparkles size={22} />
              </div>
              <p className="text-sm text-ink-500">
                {selectedSchool ? `"${selectedSchool.name}"에 대해 무엇이든 물어보세요.` : "학교나 영업 관련 질문을 자유롭게 물어보세요."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="rounded-full border border-surface-border px-3 py-1.5 text-xs text-ink-700 hover:bg-surface-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary-500 px-4 py-2.5 text-sm text-white"
                    : "max-w-[80%] rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink-900 whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-surface-muted px-4 py-2.5 text-sm text-ink-500">
                <Loader2 size={14} className="animate-spin" /> 생각 중...
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="질문을 입력하세요..."
            className="h-11 flex-1 rounded-lg border border-surface-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send size={16} />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
