"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { generateAi } from "@/lib/api/ai";
import { useFirestoreDoc } from "@/lib/hooks/useDocument";
import { SchoolDoc } from "@/types";

/**
 * 학교별 제안서를 인쇄/PDF저장 하기 좋게 보여주는 전용 페이지.
 * 서버에서 직접 PDF를 만들지 않고, 브라우저의 "인쇄 → PDF로 저장" 기능을 활용한다.
 * (서버리스 환경에서 한글 폰트를 임베드해 PDF를 생성하는 건 불안정해서, 이 방식이 훨씬 안정적이다)
 */
export default function ProposalPrintPage() {
  const params = useParams();
  const schoolId = params.schoolId as string;
  const { firebaseUser } = useAuth();
  const { data: school } = useFirestoreDoc<SchoolDoc>("schools_detail", schoolId);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || !schoolId) return;
    let cancelled = false;
    setLoading(true);
    generateAi(firebaseUser, schoolId, "proposal")
      .then((res) => {
        if (!cancelled) setText(res.text);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "제안서 생성 중 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, schoolId]);

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 print:p-0">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between rounded-lg bg-primary-50 p-4">
        <p className="text-sm text-primary-700">
          내용을 확인하신 후, 오른쪽 버튼으로 인쇄하거나 "PDF로 저장"을 선택하면 다운로드됩니다.
        </p>
        <button
          onClick={() => window.print()}
          disabled={loading || !text}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
        >
          <Printer size={16} /> 인쇄 / PDF로 저장
        </button>
      </div>

      <div className="border-b-2 border-ink-900 pb-4">
        <p className="text-xs text-ink-500">School-PASS 도입 제안서</p>
        <h1 className="mt-1 text-2xl font-bold text-ink-900">{school?.name ?? "학교"} 귀중</h1>
        <p className="mt-1 text-xs text-ink-500">
          작성일: {new Date().toLocaleDateString("ko-KR")} · ㈜바른정보기술 (VAREUN Co., Ltd.)
        </p>
      </div>

      <div className="mt-6">
        {loading && (
          <div className="flex items-center gap-2 py-16 text-sm text-ink-500">
            <Loader2 size={16} className="animate-spin" /> AI가 이 학교 맞춤 제안서를 작성하고 있습니다...
          </div>
        )}
        {error && <p className="py-16 text-sm text-status-danger">{error}</p>}
        {text && <div className="whitespace-pre-wrap text-sm leading-7 text-ink-800">{text}</div>}
      </div>
    </div>
  );
}
