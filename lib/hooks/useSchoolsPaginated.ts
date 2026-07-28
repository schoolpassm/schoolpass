"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolSummaryDoc, SchoolGrade, SchoolStatus, SchoolLevel } from "@/types";

export interface SchoolListFilters {
  region?: string;
  status?: SchoolStatus;
  grade?: SchoolGrade;
  level?: SchoolLevel;
  /** 이름 접두어 검색 (Firestore 특성상 완전한 전문검색은 아니며, 이름이 이 값으로 "시작하는" 학교만 매칭됨) */
  namePrefix?: string;
}

const PAGE_SIZE = 50;

/**
 * schools_summary만 조회한다 (schools_detail은 절대 목록 조회에 쓰지 않음).
 * limit() + startAfter() 커서 페이지네이션으로, 학교가 10만 건이어도
 * 한 번에 PAGE_SIZE(50)건만 읽어 Firestore 읽기 비용과 렌더링 부하를 일정하게 유지한다.
 */
async function fetchSchoolsPage(filters: SchoolListFilters, cursor: QueryDocumentSnapshot | null) {
  const constraints: QueryConstraint[] = [];

  if (filters.region) constraints.push(where("region", "==", filters.region));
  if (filters.level) constraints.push(where("level", "==", filters.level));
  if (filters.status) constraints.push(where("status", "==", filters.status));
  if (filters.grade) constraints.push(where("grade", "==", filters.grade));

  if (filters.namePrefix) {
    // 이름 접두어 범위 검색 (Firestore range query 트릭)
    constraints.push(where("name", ">=", filters.namePrefix));
    constraints.push(where("name", "<=", filters.namePrefix + "\uf8ff"));
    constraints.push(orderBy("name"));
  } else {
    constraints.push(orderBy("updatedAt", "desc"));
  }

  constraints.push(fbLimit(PAGE_SIZE));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, "schools_summary"), ...constraints));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc);
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

export function useSchoolsPaginated(filters: SchoolListFilters) {
  return useInfiniteQuery({
    queryKey: ["schools_summary", filters],
    queryFn: ({ pageParam }) => fetchSchoolsPage(filters, pageParam as QueryDocumentSnapshot | null),
    initialPageParam: null as QueryDocumentSnapshot | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
