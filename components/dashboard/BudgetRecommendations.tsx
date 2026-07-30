"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { formatKRW } from "@/lib/commission";

interface BudgetSchool {
  id: string;
  name: string;
  region: string;
  status: string;
  financeRevenueTotal?: number;
  developmentFundTotal?: number;
}

export function BudgetRecommendations() {
  const { firebaseUser } = useAuth();
  const [byFinance, setByFinance] = useState<BudgetSchool[] | null>(null);
  const [byFund, setByFund] = useState<BudgetSchool[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/ai/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "budget_recommendations" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "조회 실패");
      setByFinance(json.byFinance);
      setByFund(json.byFund);
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
            <Wallet size={15} className="text-emerald-500" /> 예산 기반 영업 추천
          </span>
        </CardTitle>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {byFinance ? "새로고침" : "불러오기"}
        </Button>
      </CardHeader>
      <CardBody>
        {!byFinance && !loading && !error && (
          <p className="text-xs text-ink-300">
            버튼을 누르면 학교회계 세입 규모·발전기금이 큰 학교(예산 여유 있는 학교)를 찾아줍니다.
            (공공데이터 동기화로 회계·발전기금 데이터를 먼저 채워야 결과가 나옵니다)
          </p>
        )}
        {error && <p className="text-xs text-status-danger">{error}</p>}
        {byFinance && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-500">학교회계 규모 TOP</p>
              {byFinance.length === 0 && <p className="text-xs text-ink-300">데이터 없음</p>}
              <ul className="space-y-1">
                {byFinance.map((s) => (
                  <li key={s.id}>
                    <Link href={`/schools/${s.id}`} className="flex justify-between text-xs hover:text-primary-600">
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 font-medium">{formatKRW(s.financeRevenueTotal ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-500">학교발전기금 TOP</p>
              {byFund && byFund.length === 0 && <p className="text-xs text-ink-300">데이터 없음</p>}
              <ul className="space-y-1">
                {byFund?.map((s) => (
                  <li key={s.id}>
                    <Link href={`/schools/${s.id}`} className="flex justify-between text-xs hover:text-primary-600">
                      <span className="truncate">{s.name}</span>
                      <span className="shrink-0 font-medium">{formatKRW(s.developmentFundTotal ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
