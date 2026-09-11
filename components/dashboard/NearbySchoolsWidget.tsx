"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LocateFixed, Loader2, Map as MapIcon } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useNearbySchools } from "@/lib/hooks/useNearbySchools";
import { useKakaoMapsLoader } from "@/lib/hooks/useKakaoMapsLoader";

/** 대시보드에서 바로 "지금 내 주변에 어떤 학교가 있는지" 목록+지도로 보여주는 위젯. */
export function NearbySchoolsWidget() {
  const { schools, loading, error, userLocation, radiusKm, findNearby } = useNearbySchools();
  const { ready: mapReady, hasKey: hasMapKey } = useKakaoMapsLoader();
  const [showMap, setShowMap] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  // 지도 보기를 켰고, 위치/학교 데이터가 있으면 미니맵을 그린다
  useEffect(() => {
    if (!showMap || !mapReady || !mapRef.current || !userLocation) return;
    const { kakao } = window;

    if (!mapInstance.current) {
      mapInstance.current = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
        level: 6,
      });
    } else {
      mapInstance.current.setCenter(new kakao.maps.LatLng(userLocation.lat, userLocation.lng));
    }

    // 내 위치 마커(파란 점)
    new kakao.maps.Marker({
      position: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
      map: mapInstance.current,
      image: new kakao.maps.MarkerImage(
        `data:image/svg+xml;base64,${btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="7" fill="#3B63E0" stroke="white" stroke-width="3"/></svg>'
        )}`,
        new kakao.maps.Size(20, 20),
        { offset: new kakao.maps.Point(10, 10) }
      ),
    });

    // 학교 마커
    schools.forEach((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      const marker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(s.lat, s.lng),
        map: mapInstance.current,
      });
      kakao.maps.event.addListener(marker, "click", () => window.open(`/schools/${s.id}`, "_blank"));
    });
  }, [showMap, mapReady, userLocation, schools]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-1.5">
            <LocateFixed size={15} className="text-primary-500" /> 내 주변 학교
          </span>
        </CardTitle>
        <div className="flex items-center gap-1">
          {[3, 5, 10].map((km) => (
            <button
              key={km}
              onClick={() => findNearby(km)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                radiusKm === km && schools.length + (loading ? 1 : 0) > 0
                  ? "bg-primary-500 text-white"
                  : "bg-surface-muted text-ink-500 hover:bg-surface-border"
              }`}
            >
              {km}km
            </button>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        {!loading && !error && schools.length === 0 && (
          <p className="text-xs text-ink-300">거리 버튼을 눌러 지금 내 위치 기준으로 가까운 학교를 찾아보세요.</p>
        )}
        {loading && (
          <p className="flex items-center gap-2 text-xs text-ink-500">
            <Loader2 size={14} className="animate-spin" /> 위치 확인 중... (위치 권한 팝업이 뜨면 "허용"을 눌러주세요)
          </p>
        )}
        {error && <p className="text-xs text-status-danger">{error}</p>}

        {schools.length > 0 && (
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-ink-500">{schools.length}곳 찾음 (가까운 순)</p>
              {hasMapKey && (
                <button
                  onClick={() => setShowMap((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                >
                  <MapIcon size={12} /> {showMap ? "목록으로" : "지도로 보기"}
                </button>
              )}
            </div>

            {showMap && hasMapKey && (
              <div ref={mapRef} className="mb-3 h-64 w-full rounded-lg border border-surface-border" />
            )}

            {!showMap && (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {schools.slice(0, 10).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/schools/${s.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted"
                    >
                      <span className="truncate font-medium text-ink-900">{s.name}</span>
                      <span className="ml-2 shrink-0 text-xs font-semibold text-primary-600">{s.distanceKm.toFixed(1)}km</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
