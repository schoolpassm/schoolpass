import * as XLSX from "xlsx";
import { SchoolDoc, SchoolSummaryDoc } from "@/types";

type ExportableSchool = Partial<SchoolDoc> | Partial<SchoolSummaryDoc>;

const HEADERS = [
  "지역",
  "학교명",
  "학교급",
  "주소",
  "전화번호",
  "행정실",
  "이메일",
  "교육지원청",
  "학생수",
  "담당자",
  "상태",
  "등급",
  "태그",
  "비고",
] as const;

export interface SchoolRow {
  region: string;
  name: string;
  level: string;
  address: string;
  phone: string;
  adminOfficePhone: string;
  email: string;
  eduOfficeName: string;
  studentCount: number;
  ownerName: string;
  status: string;
  grade: string;
  tags: string;
  note: string;
}

/** 학교 목록을 엑셀(.xlsx) 파일로 다운로드한다. */
export function exportSchoolsToExcel(schools: ExportableSchool[], fileName = "schools.xlsx") {
  const rows = schools.map((s) => ({
    지역: s.region ?? "",
    학교명: s.name ?? "",
    학교급: s.level ?? "",
    주소: (s as Partial<SchoolDoc>).address ?? "",
    전화번호: s.phone ?? "",
    행정실: (s as Partial<SchoolDoc>).adminOfficePhone ?? "",
    이메일: s.email ?? "",
    교육지원청: s.eduOfficeId ?? "",
    학생수: s.studentCount ?? "",
    담당자: s.ownerName ?? "",
    상태: s.status,
    등급: s.grade,
    태그: (s.tags ?? []).join(","),
    비고: (s as Partial<SchoolDoc>).note ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "학교목록");
  XLSX.writeFile(wb, fileName);
}

/** 업로드된 엑셀 파일을 파싱해 SchoolRow 배열로 변환한다. */
export async function parseSchoolExcel(file: File): Promise<SchoolRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((r) => ({
    region: String(r["지역"] ?? ""),
    name: String(r["학교명"] ?? ""),
    level: String(r["학교급"] ?? "고등학교"),
    address: String(r["주소"] ?? ""),
    phone: String(r["전화번호"] ?? ""),
    adminOfficePhone: String(r["행정실"] ?? ""),
    email: String(r["이메일"] ?? ""),
    eduOfficeName: String(r["교육지원청"] ?? ""),
    studentCount: Number(r["학생수"] ?? 0) || 0,
    ownerName: String(r["담당자"] ?? ""),
    status: String(r["상태"] || "신규"),
    grade: String(r["등급"] || "C"),
    tags: String(r["태그"] ?? ""),
    note: String(r["비고"] ?? ""),
  }));
}

/** 엑셀 업로드용 템플릿 파일 다운로드 */
export function downloadSchoolTemplate() {
  const ws = XLSX.utils.json_to_sheet(
    [
      {
        지역: "경기도 용인시",
        학교명: "용신고등학교",
        학교급: "고등학교",
        주소: "경기도 용인시 처인구 ...",
        전화번호: "031-000-0000",
        행정실: "031-000-0001",
        이메일: "school@example.go.kr",
        교육지원청: "용인교육지원청",
        학생수: 900,
        담당자: "유명환",
        상태: "신규",
        등급: "A",
        태그: "신설,여름방학타겟",
        비고: "",
      },
    ],
    { header: [...HEADERS] }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "template");
  XLSX.writeFile(wb, "schoolpass_학교업로드_템플릿.xlsx");
}
