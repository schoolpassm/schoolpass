/**
 * 선택한 여러 학교의 주소를 이용해 구글맵 다중 경유지 경로 URL을 만든다.
 * 구글맵 웹/앱에서 열리면 "경로 최적화" 옵션으로 방문 순서를 재정렬할 수 있다.
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
