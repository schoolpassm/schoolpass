"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useKakaoMapsLoader } from "@/lib/hooks/useKakaoMapsLoader";
import { useSchoolsInBounds } from "@/lib/hooks/useSchoolsInBounds";
import { haversineDistanceKm } from "@/lib/geo";
import { SchoolSummaryDoc } from "@/types";

/** 영업 상태를 3그룹으로 나눠 마커 색상을 다르게 표시한다: 구축완료(초록) / 계약(파랑) / 미접촉(회색) / 진행중(주황) */
function colorForStatus(status?: string): string {
  if (status === "설치완료") return "#16A34A"; // 구축학교 - 초록
  if (status === "계약") return "#3B63E0"; // 계약학교 - 파랑
  if (status === "신규") return "#98A2B3"; // 미접촉학교 - 회색
  return "#F0A93B"; // 그 외(전화완료~협의중 등 진행중) - 주황
}

function buildMarkerImage(kakao: any, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="3"/></svg>`;
  const url = `data:image/svg+xml;base64,${btoa(svg)}`;
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(28, 28), { offset: new kakao.maps.Point(14, 14) });
}

export function KakaoSchoolMap({ onVisibleSchoolsChange }: { onVisibleSchoolsChange?: (schools: SchoolSummaryDoc[]) => void }) {
  const { ready, error, hasKey } = useKakaoMapsLoader();
  const { schools, loading, truncated, fetchBounds } = useSchoolsInBounds();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(3);

  const refreshBounds = useCallback(() => {
    if (!mapInstance.current) return;
    const bounds = mapInstance.current.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    fetchBounds({ minLat: sw.getLat(), maxLat: ne.getLat(), minLng: sw.getLng(), maxLng: ne.getLng() });
  }, [fetchBounds]);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;
    const { kakao } = window;
    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(37.2410, 127.1775), // 기본 중심: 용인
      level: 8,
    });
    mapInstance.current = map;
    clustererRef.current = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 6,
    });
    kakao.maps.event.addListener(map, "idle", refreshBounds);
    refreshBounds();
  }, [ready, refreshBounds]);

  // schools 목록이 바뀔 때마다 마커 다시 그리기
  useEffect(() => {
    if (!ready || !mapInstance.current || !clustererRef.current) return;
    const { kakao } = window;
    clustererRef.current.clear();

    const visibleSchools = radiusCenter
      ? schools.filter(
          (s) =>
            typeof s.lat === "number" &&
            typeof s.lng === "number" &&
            haversineDistanceKm(radiusCenter.lat, radiusCenter.lng, s.lat!, s.lng!) <= radiusKm
        )
      : schools;

    const markers = visibleSchools
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(s.lat!, s.lng!),
          image: buildMarkerImage(kakao, colorForStatus(s.status)),
        });
        kakao.maps.event.addListener(marker, "click", () => {
          window.open(`/schools/${s.id}`, "_blank");
        });
        return marker;
      });

    clustererRef.current.addMarkers(markers);
    onVisibleSchoolsChange?.(visibleSchools);
  }, [schools, ready, radiusCenter, radiusKm, onVisibleSchoolsChange]);

  function handleRadiusSearch() {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRadiusCenter(center);
        if (mapInstance.current) {
          const { kakao } = window;
          mapInstance.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
        }
      },
      () => alert("위치 정보를 가져올 수 없습니다.")
    );
  }

  if (!hasKey) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-muted text-center">
        <p className="text-sm font-semibold text-ink-700">Kakao Map API 키가 설정되지 않았습니다.</p>
        <p className="mt-1 max-w-md text-xs text-ink-500">
          Kakao Developers에서 JavaScript 키를 발급받아 <code className="rounded bg-white px-1">NEXT_PUBLIC_KAKAO_MAP_KEY</code>{" "}
          환경변수에 등록하면 이 화면에 지도와 마커 클러스터링이 표시됩니다.
        </p>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-status-danger">{error}</div>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          onClick={handleRadiusSearch}
          className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-muted"
        >
          내 위치 반경 검색
        </button>
        {radiusCenter && (
          <>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="h-8 rounded-lg border border-surface-border bg-white px-2 text-xs"
            >
              {[1, 2, 3, 5, 10].map((km) => (
                <option key={km} value={km}>
                  반경 {km}km
                </option>
              ))}
            </select>
            <button
              onClick={() => setRadiusCenter(null)}
              className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-xs text-ink-500 hover:bg-surface-muted"
            >
              반경검색 해제
            </button>
          </>
        )}
        <span className="text-xs text-ink-500">
          {loading ? "불러오는 중..." : `현재 화면 ${schools.length}개교 표시${truncated ? " (더 있음, 확대해서 보세요)" : ""}`}
        </span>
      </div>
      <div ref={mapRef} className="h-[70vh] w-full rounded-xl border border-surface-border" />
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#16A34A" }} /> 구축완료</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#3B63E0" }} /> 계약</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#F0A93B" }} /> 진행중</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#98A2B3" }} /> 미접촉(신규)</span>
      </div>
    </div>
  );
}
