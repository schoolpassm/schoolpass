"use client";

import { useEffect, useState } from "react";
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
 * path: 컬렉션 경로 (예: "schools", "schools/abc/activities")
 * constraints: where/orderBy/limit 등 쿼리 제약조건
 */
export function useCollection<T = DocumentData>(
  path: string | null,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    );
    return () => unsub();
    // constraints는 매 렌더마다 새 배열이 될 수 있어 path 기준으로만 재구독한다.
    // 상위 컴포넌트에서 constraints를 useMemo로 감싸 전달하는 것을 권장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(constraints.map((c) => c.type))]);

  return { data, loading, error };
}
