"use client";

import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";

export function AiBriefingCard() {
  const { firebaseUser } = useAuth();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/ai/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "daily_briefing" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "브리핑 생성 실패");
      setText(json.text);
    } catch (e: any) {
      setError(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-primary-500" /> 오늘의 AI 브리핑
          </span>
        </CardTitle>
        <Button size="sm" variant="secondary" onClick={generate} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {text ? "새로 생성" : "브리핑 생성"}
        </Button>
      </CardHeader>
      <CardBody>
        {!text && !loading && !error && (
          <p className="text-xs text-ink-300">버튼을 눌러 오늘의 AI 영업 브리핑을 생성하세요.</p>
        )}
        {loading && <p className="text-xs text-ink-300">실제 데이터를 분석해 브리핑을 작성 중...</p>}
        {error && <p className="text-xs text-status-danger">{error}</p>}
        {text && !loading && <p className="whitespace-pre-wrap text-sm text-ink-700">{text}</p>}
      </CardBody>
    </Card>
  );
}
