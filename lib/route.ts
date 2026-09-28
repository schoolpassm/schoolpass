import { haversineDistanceKm } from "@/lib/geo";

export interface RoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

/**
 * 선택한 지점들(학교+관공서 섞여도 됨)을 가장 가까운 다음 지점을 그리디하게 골라 이어붙이는
 * 최근접이웃(Nearest Neighbor) 방식으로 방문순서를 제안한다 (스펙 14번: "이동 동선을 고려하여
 * 방문순서를 제안").
 *
 * 최적해를 보장하는 알고리즘은 아니지만(외판원 문제는 지점 수가 늘면 정확히 풀기 어려움),
 * 하루 방문지 10~20곳 규모에서는 실무적으로 충분히 합리적인 순서를 빠르게 만들어준다.
 * startLat/startLng를 주면(보통 현재 위치) 거기서 가장 가까운 지점부터 시작하고,
 * 안 주면 목록의 첫 지점에서 시작한다.
 */
export function orderByNearestNeighbor(
  points: RoutePoint[],
  start?: { lat: number; lng: number }
): { ordered: RoutePoint[]; legDistancesKm: number[]; totalKm: number } {
  if (points.length === 0) return { ordered: [], legDistancesKm: [], totalKm: 0 };

  const remaining = [...points];
  const ordered: RoutePoint[] = [];
  const legDistancesKm: number[] = [];

  let currentLat: number;
  let currentLng: number;

  if (start) {
    currentLat = start.lat;
    currentLng = start.lng;
  } else {
    const first = remaining.shift()!;
    ordered.push(first);
    currentLat = first.lat;
    currentLng = first.lng;
  }

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceKm(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    legDistancesKm.push(nearestDist);
    currentLat = next.lat;
    currentLng = next.lng;
  }

  const totalKm = legDistancesKm.reduce((sum, d) => sum + d, 0);
  return { ordered, legDistancesKm, totalKm };
}

/**
 * 선택한 여러 학교의 주소를 이용해 구글맵 다중 경유지 경로 URL을 만든다.
 * waypoints는 호출하는 쪽에서 이미 원하는 순서로(예: orderByNearestNeighbor 결과) 넘겨주면
 * 그 순서 그대로 구글맵에 전달된다 — 구글맵 자체의 "경로 최적화" 옵션은 별개로 계속 쓸 수 있다.
 */
export function buildVisitRouteUrl(addresses: string[]): string | null {
  const valid = addresses.filter(Boolean);
  if (valid.length < 2) return null;

  const origin = valid[0];
  const destination = valid[valid.length - 1];
  const middle = valid.slice(1, -1);

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (middle.length > 0) params.set("waypoints", middle.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
