"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, QueryConstraint, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolListFilters } from "@/lib/hooks/useSchoolsPaginated";

/**
 * 지금 걸려있는 필터 조건에 맞는 학교 "전체 개수"를 count() 집계쿼리로 조회한다.
 * count()는 문서를 읽지 않고 개수만 세기 때문에, 학교가 10만 건이어도 비용이 저렴하다.
 * (목록 자체는 useSchoolsPaginated가 페이지 단위로 따로 불러온다 — 이 훅은 개수 표시 전용)
 */
export function useSchoolsCount(filters: SchoolListFilters) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const constraints: QueryConstraint[] = [];
    if (filters.region) constraints.push(where("region", "==", filters.region));
    if (filters.level) constraints.push(where("level", "==", filters.level));
    if (filters.status) constraints.push(where("status", "==", filters.status));
    if (filters.grade) constraints.push(where("grade", "==", filters.grade));
    if (filters.namePrefix) {
      constraints.push(where("name", ">=", filters.namePrefix));
      constraints.push(where("name", "<=", filters.namePrefix + "\uf8ff"));
      constraints.push(orderBy("name"));
    }

    getCountFromServer(query(collection(db, "schools_summary"), ...constraints))
      .then((snap) => {
        if (!cancelled) setCount(snap.data().count);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.region, filters.level, filters.status, filters.grade, filters.namePrefix]);

  return { count, loading };
}
