"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-white shadow-pop">
            <ShieldCheck size={24} />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-ink-900">SchoolPass 영업 CRM</h1>
            <p className="text-sm text-ink-500">학교 · 교육지원청 · 계약 통합관리</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-surface-border bg-white p-6 shadow-card">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-500">이메일</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@schoolpass.co.kr" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-500">비밀번호</label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <p className="text-xs text-status-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-300">
          관리자(admin) · 매니저(manager) · 파트너(partner) 권한별로 화면이 분리됩니다.
        </p>
      </div>
    </div>
  );
}
