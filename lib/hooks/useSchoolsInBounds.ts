"use client";

import { useCallback, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolSummaryDoc } from "@/types";

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// 화면에 한 번에 표시할 마커 최대 개수 — 학교가 10만 건이어도 지도 렌더링 부하는 일정하게 유지
const MAX_MARKERS = 500;

/**
 * 현재 지도 화면(Bounds) 안에 있는 학교만 조회한다.
 * Firestore는 2차원 bounding box 쿼리를 직접 지원하지 않으므로,
 * 위도(lat) 범위로 1차 필터링한 뒤 경도(lng) 범위는 클라이언트에서 2차 필터링한다.
 * (더 정밀한 지도 서비스로 확장 시 geohash 기반 쿼리로 교체 권장 — docs 참고)
 */
export function useSchoolsInBounds() {
  const [schools, setSchools] = useState<SchoolSummaryDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const fetchBounds = useCallback(async (bounds: MapBounds) => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "schools_summary"),
          where("lat", ">=", bounds.minLat),
          where("lat", "<=", bounds.maxLat),
          limit(MAX_MARKERS)
        )
      );
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc)
        .filter((s) => typeof s.lng === "number" && s.lng! >= bounds.minLng && s.lng! <= bounds.maxLng);

      setSchools(items);
      setTruncated(snap.docs.length >= MAX_MARKERS);
    } finally {
      setLoading(false);
    }
  }, []);

  return { schools, loading, truncated, fetchBounds };
}
