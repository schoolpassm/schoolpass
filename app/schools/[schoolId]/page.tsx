"use client";

export const dynamic = "force-dynamic";

import { useFirestoreDoc } from "@/lib/hooks/useDocument";
import { AppShell } from "@/components/layout/AppShell";
import { SchoolDetailHeader } from "@/components/schools/SchoolDetailHeader";
import { ActivityTimeline } from "@/components/schools/ActivityTimeline";
import { QuotesTab } from "@/components/schools/QuotesTab";
import { FilesTab } from "@/components/schools/FilesTab";
import { AiToolsPanel } from "@/components/schools/AiToolsPanel";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardBody } from "@/components/ui/Card";
import { SchoolDoc } from "@/types";

export default function SchoolDetailPage({ params }: { params: { schoolId: string } }) {
  const { data: school, loading } = useFirestoreDoc<SchoolDoc>("schools_detail", params.schoolId);

  return (
    <AppShell title="학교 상세">
      {loading && <p className="text-sm text-ink-300">불러오는 중...</p>}
      {!loading && !school && <p className="text-sm text-ink-300">학교 정보를 찾을 수 없습니다.</p>}
      {school && (
        <div className="space-y-4">
          <SchoolDetailHeader school={school} />
          <AiToolsPanel
            schoolId={school.id}
            schoolName={school.name}
            contactEmail={school.contactEmail || school.email}
          />
          <Card>
            <CardBody>
              <Tabs
                tabs={[
                  { key: "activity", label: "활동기록 (전화·이메일·문자·방문)", content: <ActivityTimeline schoolId={school.id} /> },
                  { key: "quotes", label: "견적", content: <QuotesTab schoolId={school.id} /> },
                  { key: "files", label: "첨부파일 (브로슈어·사진)", content: <FilesTab schoolId={school.id} /> },
                  { key: "note", label: "메모", content: <p className="whitespace-pre-wrap text-sm text-ink-700">{school.note || "메모가 없습니다."}</p> },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
