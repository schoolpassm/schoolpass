"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Firestore 컬렉션을 실시간 구독하는 범용 훅.
 * path: 컬렉션 경로 (예: "schools_summary", "schools_detail/abc/activities")
 * constraints: where/orderBy/limit 등 쿼리 제약조건
 *
 * 인덱스 누락 등으로 최초 구독이 실패하더라도, 인덱스가 나중에 생성되면
 * 페이지 새로고침 없이 자동으로 재구독을 시도한다(아래 retryTick 참고).
 */
export function useCollection<T = DocumentData>(
  path: string | null,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const constraintsKey = JSON.stringify(constraints.map((c) => c.type));

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[]);
        setLoading(false);
        setError(null); // 이전에 에러가 있었더라도 정상 수신되면 즉시 해제
      },
      (err) => {
        setError(err);
        setLoading(false);
        // 인덱스 생성 등으로 나중에 해결될 수 있으므로 15초 뒤 자동 재구독 시도
        if (err.message.includes("index")) {
          setTimeout(() => setRetryTick((t) => t + 1), 15000);
        }
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, constraintsKey, retryTick]);

  return { data, loading, error };
}
