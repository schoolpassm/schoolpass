"use client";

export const dynamic = "force-dynamic";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { Route, MapPin, Navigation, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { KakaoSchoolMap } from "@/components/schools/KakaoSchoolMap";
import { useCollection } from "@/lib/hooks/useCollection";
import { useAuth } from "@/lib/auth-context";
import { InstitutionDoc, SchoolSummaryDoc } from "@/types";
import { orderByNearestNeighbor, buildVisitRouteUrl, RoutePoint } from "@/lib/route";
import { isStalled as isInstitutionStalled } from "@/lib/public-pipeline";

const REVISIT_THRESHOLD_DAYS = 14;

function daysSince(ts: any): number | null {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

type SelKey = string; // `school:${id}` | `institution:${id}`

/**
 * 방문 동선 화면 (스펙 14번).
 * 학교+관공서/교육행정기관을 한 지도에 같이 표시하고, 체크박스로 오늘 방문할 곳을 고르면
 * 최근접이웃 알고리즘으로 방문순서를 제안한 뒤, 그 순서 그대로 구글맵 길찾기로 열 수 있다.
 */
export default function VisitPlannerPage() {
  const { firebaseUser } = useAuth();
  const [visibleSchools, setVisibleSchools] = useState<SchoolSummaryDoc[]>([]);
  const { data: institutions } = useCollection<InstitutionDoc>("institutions", [orderBy("updatedAt", "desc")]);
  const [selected, setSelected] = useState<Set<SelKey>>(new Set());
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<{ ordered: RoutePoint[]; legDistancesKm: number[]; totalKm: number } | null>(null);

  const handleVisibleChange = useCallback((schools: SchoolSummaryDoc[]) => {
    setVisibleSchools(schools);
  }, []);

  const groups = useMemo(() => {
    const plannedVisit = visibleSchools.filter((s) => s.status === "방문예정");
    const completed = visibleSchools.filter((s) => s.status === "설치완료");
    const needsRevisit = visibleSchools.filter((s) => {
      if (s.status === "설치완료" || s.status === "실패") return false;
      const d = daysSince(s.lastContactedAt);
      return d !== null && d >= REVISIT_THRESHOLD_DAYS;
    });
    const nearbySchools = visibleSchools; // 지도 화면에 보이는 전체 학교 = "인근 학교"
    const nearbyEduOffices = institutions.filter((i) => i.type === "교육지원청" || i.type === "교육청");
    return { plannedVisit, completed, needsRevisit, nearbySchools, nearbyEduOffices };
  }, [visibleSchools, institutions]);

  function toggle(key: SelKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setRoute(null); // 선택이 바뀌면 이전에 계산한 동선은 무효화
  }

  function collectSelectedPoints(): RoutePoint[] {
    const points: RoutePoint[] = [];
    for (const key of selected) {
      const [kind, id] = key.split(":");
      if (kind === "school") {
        const s = visibleSchools.find((x) => x.id === id);
        if (s && typeof s.lat === "number" && typeof s.lng === "number") {
          points.push({ id: key, name: s.name, lat: s.lat, lng: s.lng, address: s.address });
        }
      } else {
        const i = institutions.find((x) => x.id === id);
        if (i && typeof i.lat === "number" && typeof i.lng === "number") {
          points.push({ id: key, name: i.name, lat: i.lat, lng: i.lng, address: i.address });
        }
      }
    }
    return points;
  }

  function computeRoute(start?: { lat: number; lng: number }) {
    const points = collectSelectedPoints();
    if (points.length < 2) {
      alert("좌표가 있는 지점을 2곳 이상 선택하세요.");
      return;
    }
    setRoute(orderByNearestNeighbor(points, start));
  }

  function handleSuggestRoute() {
    if (!navigator.geolocation) {
      computeRoute();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        computeRoute({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        computeRoute(); // 위치 거부/실패 시 현재 위치 없이(첫 선택지 기준으로) 계산
      },
      { timeout: 5000 }
    );
  }

  function handleOpenGoogleMaps() {
    if (!route) return;
    const addresses = route.ordered.map((p) => p.address).filter((a): a is string => !!a);
    const url = buildVisitRouteUrl(addresses);
    if (!url) {
      alert("주소 정보가 있는 지점이 2곳 이상이어야 구글맵을 열 수 있습니다.");
      return;
    }
    window.open(url, "_blank");
  }

  function renderList(title: string, items: { key: SelKey; name: string; sub: string }[]) {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="mb-1.5 px-1 text-xs font-semibold text-ink-500">
          {title} ({items.length})
        </p>
        {items.map((item) => (
          <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
            <input
              type="checkbox"
              checked={selected.has(item.key)}
              onChange={() => toggle(item.key)}
              className="h-4 w-4 accent-primary-500"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink-900">{item.name}</p>
              <p className="truncate text-[11px] text-ink-500">{item.sub}</p>
            </div>
          </label>
        ))}
      </div>
    );
  }

  return (
    <AppShell title="방문 동선 계획">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          지도에 학교(원형)와 관공서/교육행정기관(다이아몬드)이 함께 표시됩니다. 방문할 곳을
          오른쪽 목록에서 체크하고 "방문순서 제안"을 누르세요.
        </p>
        {selected.size > 0 && (
          <Button size="sm" onClick={handleSuggestRoute} disabled={locating}>
            {locating ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
            {locating ? "위치 확인 중..." : `선택 ${selected.size}곳 방문순서 제안`}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          <KakaoSchoolMap onVisibleSchoolsChange={handleVisibleChange} institutions={institutions} />

          {route && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>제안된 방문순서 (총 {route.totalKm.toFixed(1)}km)</CardTitle>
                <Button size="sm" variant="secondary" onClick={handleOpenGoogleMaps}>
                  <Navigation size={14} /> 구글맵으로 열기
                </Button>
              </CardHeader>
              <CardBody>
                <ol className="space-y-2">
                  {route.ordered.map((p, idx) => (
                    <li key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-ink-900">{p.name}</span>
                      {idx > 0 && (
                        <span className="text-xs text-ink-400">+{route.legDistancesKm[idx - 1].toFixed(1)}km</span>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[11px] text-ink-300">
                  ※ 최근접이웃 방식의 직선거리 기준 제안입니다. 실제 도로 상황(일방통행, 정체 등)은
                  반영되지 않으니 최종 순서는 구글맵에서 한 번 더 확인하세요.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="max-h-[80vh] overflow-y-auto rounded-xl border border-surface-border bg-white p-2">
          {renderList(
            "방문 예정 학교",
            groups.plannedVisit.map((s) => ({ key: `school:${s.id}`, name: s.name, sub: s.region }))
          )}
          {renderList(
            "재방문 필요 학교 (14일+ 미접촉)",
            groups.needsRevisit.map((s) => ({
              key: `school:${s.id}`,
              name: s.name,
              sub: `${s.region} · ${daysSince(s.lastContactedAt)}일 전 접촉`,
            }))
          )}
          {renderList(
            "인근 교육지원청/교육청",
            groups.nearbyEduOffices.map((i) => ({
              key: `institution:${i.id}`,
              name: i.name,
              sub: `${i.region || "지역미상"}${isInstitutionStalled(i) ? " · ⚠ 정체 중" : ""}`,
            }))
          )}
          {renderList(
            "방문 완료 학교",
            groups.completed.map((s) => ({ key: `school:${s.id}`, name: s.name, sub: s.region }))
          )}
          {renderList(
            "인근 학교 (지도에 보이는 전체)",
            groups.nearbySchools.map((s) => ({ key: `school:${s.id}`, name: s.name, sub: s.region }))
          )}
          {visibleSchools.length === 0 && institutions.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-ink-300">지도를 이동하면 목록이 채워집니다.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
