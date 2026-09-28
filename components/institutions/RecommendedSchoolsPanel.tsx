"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { School, Users, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { GradeBadge, StatusBadge } from "@/components/ui/Badge";
import { getChildInstitutions } from "@/lib/api/institutions";
import { getSchoolsByEduOfficeIds } from "@/lib/api/schools";
import { InstitutionDoc, SchoolSummaryDoc } from "@/types";
import { formatDate } from "@/lib/utils";

const EXCLUDED_STATUSES = new Set(["설치완료", "계약", "실패"]);
const ADOPTED_STATUSES = new Set(["설치완료", "계약"]);
const MAX_CANDIDATES = 10;

/**
 * 교육지원청/교육청 상세페이지 전용 "추천 학교" 패널 (스펙 12번).
 *
 * 실제 CRM에 있는 값만 근거로 삼는다 — 학생수(studentCount), 기존 AI 계약가능성 점수(aiScore,
 * 코드 고정 가중치표 기반으로 이미 계산돼 있는 값), 현재 영업단계, 같은 교육지원청 내 이미
 * 도입/계약된 학교 수(사회적 증거). 방문객 규모·수기 방문대장 여부·홈페이지 정보처럼 CRM에
 * 없는 항목은 "미확인"으로만 표시하고 절대 추정하지 않는다 (스펙 12번 마지막 문장).
 *
 * 정렬은 AI를 호출해 매번 다른 문구를 만드는 대신, 있는 데이터로 투명하게 계산되는 규칙
 * (aiScore desc → 학생수 desc)을 쓴다 — 근거 없는 문장을 지어낼 여지를 원천적으로 없애기 위함.
 */
export function RecommendedSchoolsPanel({ institution }: { institution: InstitutionDoc }) {
  const [schools, setSchools] = useState<SchoolSummaryDoc[] | null>(null);
  const [loading, setLoading] = useState(true);

  const applicable = institution.type === "교육지원청" || institution.type === "교육청";

  useEffect(() => {
    if (!applicable) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let eduOfficeIds: string[] = [];
      if (institution.type === "교육지원청") {
        eduOfficeIds = [institution.id];
      } else {
        // 교육청: 직속 하위 교육지원청들을 모아 그 산하 학교 전체를 대상으로 한다
        const children = await getChildInstitutions(institution.id);
        eduOfficeIds = children.filter((c) => c.type === "교육지원청").map((c) => c.id);
      }
      const result = eduOfficeIds.length > 0 ? await getSchoolsByEduOfficeIds(eduOfficeIds) : [];
      if (!cancelled) {
        setSchools(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicable, institution.id, institution.type]);

  const { candidates, adoptedCount, totalLinked } = useMemo(() => {
    const all = schools ?? [];
    const adopted = all.filter((s) => ADOPTED_STATUSES.has(s.status)).length;
    const pool = all.filter((s) => !EXCLUDED_STATUSES.has(s.status));
    const sorted = [...pool].sort((a, b) => {
      const scoreDiff = (b.aiScore ?? -1) - (a.aiScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.studentCount ?? 0) - (a.studentCount ?? 0);
    });
    return { candidates: sorted.slice(0, MAX_CANDIDATES), adoptedCount: adopted, totalLinked: all.length };
  }, [schools]);

  if (!applicable) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>추천 학교</CardTitle>
      </CardHeader>
      <CardBody>
        {loading && <p className="text-xs text-ink-300">불러오는 중...</p>}
        {!loading && totalLinked === 0 && (
          <p className="text-xs text-ink-300">이 기관에 연결된 학교가 아직 없습니다.</p>
        )}
        {!loading && totalLinked > 0 && (
          <>
            <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-500">
              <TrendingUp size={13} />
              연결된 학교 {totalLinked}곳 중 이미 도입/계약 {adoptedCount}곳 — 나머지 {candidates.length}곳을 AI 점수·학생수
              기준으로 우선순위화
            </p>
            {candidates.length === 0 && <p className="text-xs text-ink-300">추천할 만한 신규 후보가 없습니다 (전부 이미 도입·계약·실패 처리됨).</p>}
            <ul className="space-y-2">
              {candidates.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/schools/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-3 text-sm hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-2">
                      <School size={14} className="text-ink-400" />
                      <div>
                        <p className="font-medium text-ink-900">{s.name}</p>
                        <p className="flex items-center gap-2 text-xs text-ink-500">
                          {s.studentCount != null && (
                            <span className="flex items-center gap-0.5">
                              <Users size={11} /> 학생 {s.studentCount}명
                            </span>
                          )}
                          {s.aiScore != null ? `AI 점수 ${s.aiScore}점` : "AI 점수 미산정"}
                          {s.lastContactedAt ? ` · 최근접촉 ${formatDate(s.lastContactedAt)}` : " · 접촉 이력 없음"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <GradeBadge grade={s.grade} />
                      <StatusBadge status={s.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-300">
              ※ 방문객 규모·수기 방문대장 사용 여부·홈페이지 정보 등은 CRM에 수집된 데이터가 없어 이
              목록에 반영하지 않았습니다. 확인된 항목(학생수·AI 점수·영업단계·인근 도입 현황)만
              근거로 삼았습니다.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
