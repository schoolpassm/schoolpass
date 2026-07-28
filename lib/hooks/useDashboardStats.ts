"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PIPELINE_STAGES, SchoolSummaryDoc, SchoolStatus } from "@/types";

export interface DashboardStats {
  totalSchools: number;
  stageCounts: Record<SchoolStatus, number>;
  topVisitTargets: SchoolSummaryDoc[]; // 오늘 방문 추천 TOP10 (AI 점수 기준)
  topContractProbability: SchoolSummaryDoc[]; // 계약 가능성 TOP20
  weeklyCallTargets: SchoolSummaryDoc[]; // 이번주 전화 대상 (신규 + 최근 미접촉 우선)
  loading: boolean;
}

const ACTIVE_STAGES: SchoolStatus[] = ["신규", "전화완료", "자료발송", "방문예정", "시연", "견적", "협의중"];

/**
 * count() 집계쿼리를 사용해 문서 전체를 읽지 않고 개수만 가져온다 (Firestore 과금은 count 1회로 처리됨).
 * TOP-N 목록들은 모두 limit()으로 bounded 쿼리만 사용한다.
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSchools: 0,
    stageCounts: {} as Record<SchoolStatus, number>,
    topVisitTargets: [],
    topContractProbability: [],
    weeklyCallTargets: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const summaryCol = collection(db, "schools_summary");

      const [totalSnap, ...stageSnaps] = await Promise.all([
        getCountFromServer(query(summaryCol)),
        ...PIPELINE_STAGES.map((stage) => getCountFromServer(query(summaryCol, where("status", "==", stage)))),
      ]);

      const stageCounts = {} as Record<SchoolStatus, number>;
      PIPELINE_STAGES.forEach((stage, i) => {
        stageCounts[stage] = stageSnaps[i].data().count;
      });

      // 계약 가능성 TOP20 (AI 점수 내림차순, bounded)
      const topScoreSnap = await getDocs(query(summaryCol, orderBy("aiScore", "desc"), limit(20)));
      const topContractProbability = topScoreSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc);
      const topVisitTargets = topContractProbability.slice(0, 10);

      // 이번주 전화 대상: 신규 상태 학교 중 최근 미접촉 우선 (최대 50건만 읽어 클라이언트에서 정렬)
      const newSnap = await getDocs(query(summaryCol, where("status", "==", "신규"), limit(50)));
      const weeklyCallTargets = newSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc)
        .sort((a, b) => {
          const aTime = a.lastContactedAt?.toMillis() ?? 0;
          const bTime = b.lastContactedAt?.toMillis() ?? 0;
          return aTime - bTime; // 접촉기록 없거나 오래된 순
        })
        .slice(0, 10);

      if (!cancelled) {
        setStats({
          totalSchools: totalSnap.data().count,
          stageCounts,
          topVisitTargets,
          topContractProbability,
          weeklyCallTargets,
          loading: false,
        });
      }
    }

    load().catch((err) => {
      console.error("dashboard stats load failed", err);
      if (!cancelled) setStats((s) => ({ ...s, loading: false }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
