"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  MessageSquare,
  FileText,
  ClipboardList,
  Star,
  Building2,
  Copy,
  Save,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { generateAi } from "@/lib/api/ai";
import { addSchoolActivity } from "@/lib/api/schools";
import { openProposalPrintView } from "@/lib/print";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AiAction } from "@/lib/ai-prompts";
import { cn } from "@/lib/utils";

const ACTIONS: { key: AiAction; label: string; icon: any; hint: string }[] = [
  { key: "call_script", label: "전화 스크립트", icon: Phone, hint: "행정실 첫 통화용 스크립트" },
  { key: "email", label: "이메일 작성", icon: Mail, hint: "소개 이메일 제목+본문" },
  { key: "sms", label: "문자 작성", icon: MessageSquare, hint: "80자 이내 짧은 문자" },
  { key: "visit_log", label: "방문일지 작성", icon: ClipboardList, hint: "방문 기록 초안" },
  { key: "score", label: "계약 가능성 점수", icon: Star, hint: "0~100점 + 근거" },
  { key: "nearby_cases", label: "인근 구축학교 추천", icon: Building2, hint: "유사 사례 레퍼런스" },
  { key: "proposal", label: "제안서 생성 (PDF)", icon: FileText, hint: "A4 1장 분량 제안서" },
];

export function AiToolsPanel({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const { firebaseUser, userDoc } = useAuth();
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleRun(action: AiAction) {
    if (!firebaseUser) return;
    setActiveAction(action);
    setLoading(true);
    setError(null);
    setResultText("");
    setScore(null);
    setSaved(false);
    try {
      const result = await generateAi(firebaseUser, schoolId, action);
      setResultText(result.text);
      setScore(result.score);
    } catch (e: any) {
      setError(e.message || "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveActivity(type: "call" | "email" | "sms" | "visit") {
    if (!firebaseUser) return;
    await addSchoolActivity(schoolId, {
      type,
      summary: resultText,
      authorUid: firebaseUser.uid,
      authorName: userDoc?.name ?? "",
    });
    setSaved(true);
  }

  async function handleSaveScore() {
    if (score == null) return;
    await updateDoc(doc(db, "schools", schoolId), {
      aiScore: score,
      aiScoreReason: resultText,
      aiScoreUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            const isActive = activeAction === a.key;
            return (
              <button
                key={a.key}
                onClick={() => handleRun(a.key)}
                disabled={loading}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                  isActive ? "border-primary-300 bg-primary-50" : "border-surface-border hover:bg-surface-muted"
                )}
              >
                <div className="flex items-center gap-1.5 text-primary-600">
                  {loading && isActive ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                  <span className="text-xs font-semibold text-ink-900">{a.label}</span>
                </div>
                <span className="text-[11px] text-ink-500">{a.hint}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-status-danger">{error}</div>}

        {activeAction && !loading && resultText && (
          <div className="mt-4 rounded-lg border border-surface-border bg-surface-muted p-4">
            {activeAction === "score" && score != null && (
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-500 text-lg font-bold text-white">
                  {score}
                </div>
                <p className="text-xs text-ink-500">계약 성사 가능성 점수 (100점 만점)</p>
              </div>
            )}
            <p className="whitespace-pre-wrap text-sm text-ink-700">{resultText}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(resultText)}>
                <Copy size={13} /> 복사
              </Button>

              {activeAction === "call_script" && (
                <Button size="sm" onClick={() => handleSaveActivity("call")} disabled={saved}>
                  <Save size={13} /> {saved ? "저장됨" : "전화기록에 저장"}
                </Button>
              )}
              {activeAction === "email" && (
                <Button size="sm" onClick={() => handleSaveActivity("email")} disabled={saved}>
                  <Save size={13} /> {saved ? "저장됨" : "이메일기록에 저장"}
                </Button>
              )}
              {activeAction === "sms" && (
                <Button size="sm" onClick={() => handleSaveActivity("sms")} disabled={saved}>
                  <Save size={13} /> {saved ? "저장됨" : "문자기록에 저장"}
                </Button>
              )}
              {activeAction === "visit_log" && (
                <Button size="sm" onClick={() => handleSaveActivity("visit")} disabled={saved}>
                  <Save size={13} /> {saved ? "저장됨" : "방문기록에 저장"}
                </Button>
              )}
              {activeAction === "score" && (
                <Button size="sm" onClick={handleSaveScore} disabled={saved}>
                  <Save size={13} /> {saved ? "저장됨" : "학교 정보에 저장"}
                </Button>
              )}
              {activeAction === "proposal" && (
                <Button size="sm" onClick={() => openProposalPrintView(schoolName, resultText)}>
                  <FileText size={13} /> 인쇄해서 PDF로 저장
                </Button>
              )}
            </div>
            {activeAction === "proposal" && (
              <p className="mt-2 text-[11px] text-ink-300">
                인쇄 창에서 "대상: PDF로 저장"을 선택하면 PDF 파일로 저장됩니다. 저장 후 아래 "첨부파일" 탭에서 업로드하면 학교 기록에 보관됩니다.
              </p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
