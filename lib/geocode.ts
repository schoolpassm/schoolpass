/**
 * Kakao Local API를 이용한 주소 → 좌표(위경도) 변환 (지오코딩).
 * 서버 전용 — KAKAO_REST_API_KEY 필요 (Kakao Developers, JavaScript 키와는 별개의 REST API 키).
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.");
  if (!address) return null;

  const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const doc = json.documents?.[0];
  if (!doc) return null;
  return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
}
