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
  HelpCircle,
  ShieldQuestion,
  Target,
} from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { generateAi } from "@/lib/api/ai";
import { addSchoolActivity, updateSchool } from "@/lib/api/schools";
import { openProposalPrintView } from "@/lib/print";
import { AiAction } from "@/lib/ai-prompts";
import { cn } from "@/lib/utils";

import { formatKRW } from "@/lib/commission";

const ACTIONS: { key: AiAction; label: string; icon: any; hint: string }[] = [
  { key: "score", label: "계약 가능성 점수", icon: Star, hint: "0~100점 + 실제 근거" },
  { key: "call_script", label: "전화 스크립트", icon: Phone, hint: "행정실 첫 통화용" },
  { key: "email", label: "이메일 작성", icon: Mail, hint: "소개 이메일 제목+본문" },
  { key: "sms", label: "문자 작성", icon: MessageSquare, hint: "80자 이내 짧은 문자" },
  { key: "visit_log", label: "방문일지 작성", icon: ClipboardList, hint: "방문 기록 초안" },
  { key: "counseling_summary", label: "상담 요약", icon: FileText, hint: "지금까지 진행상황 요약" },
  { key: "nearby_cases", label: "구축학교 추천", icon: Building2, hint: "인근/유사 구축학교" },
  { key: "expected_questions", label: "예상 질문", icon: HelpCircle, hint: "상담 중 나올 질문 5개" },
  { key: "objection_handling", label: "반박 대응", icon: ShieldQuestion, hint: "거절 사유별 대응 멘트" },
  { key: "selling_points", label: "제안 포인트", icon: Target, hint: "맞춤 셀링포인트 3가지" },
  { key: "proposal", label: "제안서 생성 (PDF)", icon: FileText, hint: "A4 1장 분량 제안서" },
];

export function AiToolsPanel({
  schoolId,
  schoolName,
  contactEmail,
}: {
  schoolId: string;
  schoolName: string;
  contactEmail?: string;
}) {
  const { firebaseUser, userDoc } = useAuth();
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [factors, setFactors] = useState<{ label: string; positive: boolean }[]>([]);
  const [neighbors, setNeighbors] = useState<
    { name: string; distanceKm?: number; studentCount?: number; sameEduOffice: boolean; sameLevel: boolean }[]
  >([]);
  const [saved, setSaved] = useState(false);
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const [visitWindow, setVisitWindow] = useState<string | null>(null);

  async function handleRun(action: AiAction) {
    if (!firebaseUser) return;
    setActiveAction(action);
    setLoading(true);
    setError(null);
    setResultText("");
    setScore(null);
    setFactors([]);
    setNeighbors([]);
    setSaved(false);
    setExpectedAmount(null);
    setVisitWindow(null);
    try {
      const result = await generateAi(firebaseUser, schoolId, action);
      setResultText(result.text);
      setScore(result.score);
      setFactors(result.factors ?? []);
      setNeighbors(result.installedNeighbors ?? []);
      setExpectedAmount(result.expectedContractAmount ?? null);
      setVisitWindow(result.recommendedVisitWindow ?? null);
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
    await updateSchool(schoolId, {
      aiScore: score,
      aiScoreReason: resultText,
      aiScoreFactors: factors,
    });
    setSaved(true);
  }

  function handleOpenMailApp() {
    // AI가 "제목: ..." 형태로 첫 줄에 제목을 쓰는 경우가 많아 시도해서 분리, 없으면 전체를 본문으로
    const lines = resultText.split("\n");
    let subject = `${schoolName} SchoolPASS 소개`;
    let body = resultText;
    const subjectLine = lines.find((l) => /^제목\s*[:：]/.test(l.trim()));
    if (subjectLine) {
      subject = subjectLine.replace(/^제목\s*[:：]/, "").trim();
      body = lines.filter((l) => l !== subjectLine).join("\n").trim();
    }
    const mailto = `mailto:${contactEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
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
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xl font-bold text-white">
                    {score}%
                  </div>
                  <div>
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={16} fill={i < Math.round(score / 20) ? "currentColor" : "none"} />
                      ))}
                    </div>
                    <p className="text-xs text-ink-500">계약 성사 가능성 (실제 데이터 기반)</p>
                  </div>
                </div>
                {factors.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {factors.map((f, i) => (
                      <span
                        key={i}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          f.positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        )}
                      >
                        {f.positive ? "+" : "−"} {f.label}
                      </span>
                    ))}
                  </div>
                )}
                {(expectedAmount != null || visitWindow) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {expectedAmount != null && (
                      <div className="rounded-lg bg-white p-2 text-center shadow-card">
                        <p className="text-[11px] text-ink-500">예상 계약금액</p>
                        <p className="text-sm font-bold text-ink-900">{formatKRW(expectedAmount)}</p>
                      </div>
                    )}
                    {visitWindow && (
                      <div className="rounded-lg bg-white p-2 text-center shadow-card">
                        <p className="text-[11px] text-ink-500">추천</p>
                        <p className="text-sm font-bold text-primary-600">{visitWindow}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeAction === "nearby_cases" && neighbors.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {neighbors.map((n, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white p-2.5 shadow-card">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-emerald-500" />
                      <span className="text-sm font-medium text-ink-900">{n.name}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        현재 운영중
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-ink-500">
                      {n.distanceKm != null && <span>{n.distanceKm.toFixed(1)}km</span>}
                      {n.studentCount != null && <span>학생수 {n.studentCount}명</span>}
                      {n.sameEduOffice && <span className="text-primary-600">같은 교육지원청</span>}
                    </div>
                  </div>
                ))}
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
                <>
                  <Button size="sm" variant="secondary" onClick={handleOpenMailApp}>
                    <Mail size={13} /> 메일 앱으로 열기{contactEmail && ` (${contactEmail})`}
                  </Button>
                  <Button size="sm" onClick={() => handleSaveActivity("email")} disabled={saved}>
                    <Save size={13} /> {saved ? "저장됨" : "이메일기록에 저장"}
                  </Button>
                </>
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
