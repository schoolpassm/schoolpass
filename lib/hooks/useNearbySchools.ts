"use client";

import { useCallback, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SchoolSummaryDoc } from "@/types";

// 화면에 한 번에 보여줄 최대 개수 — 학교가 10만 건이어도 조회 비용은 일정하게 유지
const MAX_RESULTS = 500;
const TOP_N = 30; // 실제로 화면에 표시할 "가장 가까운" 개수

export interface NearbySchool extends SchoolSummaryDoc {
  distanceKm: number;
}

/** 위경도 두 점 사이의 직선거리(km) — 지도 페이지에서 쓰던 것과 동일한 공식 */
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 브라우저 GPS로 현재 위치를 구하고, 지정한 반경(km) 안의 학교를 가까운 순으로 정렬해서 돌려준다.
 * Firestore는 정확한 "반경 검색"을 직접 지원하지 않아서, 위도 범위로 1차 필터링한 뒤
 * (지도 페이지의 useSchoolsInBounds와 같은 방식) 실제 거리는 클라이언트에서 계산해 정렬한다.
 */
export function useNearbySchools() {
  const [schools, setSchools] = useState<NearbySchool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);

  const findNearby = useCallback((radius: number) => {
    if (!navigator.geolocation) {
      setError("이 브라우저는 위치 확인을 지원하지 않습니다.");
      return;
    }
    setRadiusKm(radius);
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        try {
          // 위도 1도 ≈ 111km이므로, 반경(km)에 여유를 좀 더 둔 델타로 1차 범위를 잡는다
          // (경도는 위도에 따라 거리 환산이 달라지므로 넉넉히 잡고 아래에서 정확히 재필터링)
          const delta = (radius / 111) * 1.3;
          const snap = await getDocs(
            query(
              collection(db, "schools_summary"),
              where("lat", ">=", latitude - delta),
              where("lat", "<=", latitude + delta),
              limit(MAX_RESULTS)
            )
          );

          const withDistance = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc)
            .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
            .map((s) => ({ ...s, distanceKm: haversineDistanceKm(latitude, longitude, s.lat!, s.lng!) }))
            .filter((s) => s.distanceKm <= radius)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, TOP_N);

          setSchools(withDistance);
        } catch (e: any) {
          setError(e.message || "학교를 불러오는 중 오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        setLoading(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError("위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해주세요.");
        } else {
          setError("위치를 확인할 수 없습니다. GPS/네트워크 상태를 확인해주세요.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { schools, loading, error, userLocation, radiusKm, findNearby };
}
