"use client";

import { useState } from "react";
import { Phone, Mail, MessageSquare, FileText, HelpCircle, ShieldQuestion, Copy, Check, Loader2, Sparkles, Target } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { addInstitutionActivity } from "@/lib/api/institutions";

const ACTIONS: { key: string; label: string; icon: any }[] = [
  { key: "next_action", label: "다음 액션 추천", icon: Target },
  { key: "call_script", label: "전화 스크립트", icon: Phone },
  { key: "email", label: "이메일", icon: Mail },
  { key: "sms", label: "문자", icon: MessageSquare },
  { key: "proposal", label: "제안서", icon: FileText },
  { key: "expected_questions", label: "예상질문", icon: HelpCircle },
  { key: "objection_handling", label: "반박대응", icon: ShieldQuestion },
];

export function InstitutionAiToolsPanel({ institutionId }: { institutionId: string }) {
  const { firebaseUser, userDoc } = useAuth();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [resultText, setResultText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleGenerate(action: string) {
    if (!firebaseUser) return;
    setActiveAction(action);
    setLoading(true);
    setError(null);
    setResultText("");
    setSaved(false);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/ai/institution-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ institutionId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "생성 실패");
      setResultText(json.text);
    } catch (e: any) {
      setError(e.message || "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSaveActivity(type: "call" | "email" | "sms") {
    if (!firebaseUser) return;
    await addInstitutionActivity(institutionId, {
      type,
      summary: resultText,
      authorUid: firebaseUser.uid,
      authorName: userDoc?.name ?? "",
    });
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-primary-500" /> AI 영업도구
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="mb-4 flex flex-wrap gap-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => handleGenerate(a.key)}
                disabled={loading}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
                  activeAction === a.key
                    ? "border-primary-300 bg-primary-50 text-primary-700"
                    : "border-surface-border text-ink-700 hover:bg-surface-muted"
                }`}
              >
                <Icon size={13} /> {a.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Loader2 size={14} className="animate-spin" /> AI가 작성 중입니다...
          </p>
        )}
        {error && <p className="text-xs text-status-danger">{error}</p>}
        {resultText && !loading && (
          <div>
            <div className="rounded-lg bg-surface-muted p-3 text-sm leading-6 text-ink-800 whitespace-pre-wrap">{resultText}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "복사됨" : "복사"}
              </Button>
              {(activeAction === "call_script" || activeAction === "email" || activeAction === "sms") && (
                <Button
                  size="sm"
                  onClick={() =>
                    handleSaveActivity(activeAction === "call_script" ? "call" : (activeAction as "email" | "sms"))
                  }
                  disabled={saved}
                >
                  {saved ? "저장됨" : "활동기록에 저장"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
