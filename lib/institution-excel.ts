import * as XLSX from "xlsx";

export interface InstitutionRow {
  name: string;
  type: string;
  region: string;
  address: string;
  phone: string;
  contactName: string;
  contactTitle: string;
  status: string;
  grade: string;
  tags: string;
  note: string;
}

/** 업로드된 엑셀 파일을 파싱해 InstitutionRow 배열로 변환한다. */
export async function parseInstitutionExcel(file: File): Promise<InstitutionRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((r) => ({
      name: String(r["기관명"] ?? "").trim(),
      type: String(r["유형"] ?? "시청").trim(),
      region: String(r["지역"] ?? "").trim(),
      address: String(r["주소"] ?? "").trim(),
      phone: String(r["대표전화"] ?? "").trim(),
      contactName: String(r["담당자"] ?? "").trim(),
      contactTitle: String(r["담당자 직책"] ?? "").trim(),
      status: String(r["상태"] || "신규").trim(),
      grade: String(r["등급"] || "C").trim(),
      tags: String(r["태그"] ?? "").trim(),
      note: String(r["비고"] ?? "").trim(),
    }))
    .filter((r) => r.name); // 기관명 없는 빈 행은 제외
}

/** 엑셀 업로드용 템플릿 다운로드 */
export function downloadInstitutionTemplate() {
  const HEADERS = ["기관명", "유형", "지역", "주소", "대표전화", "담당자", "담당자 직책", "상태", "등급", "태그", "비고"];
  const ws = XLSX.utils.json_to_sheet(
    [
      {
        기관명: "용인시청",
        유형: "시청",
        지역: "경기도 용인시",
        주소: "경기도 용인시 처인구 ...",
        대표전화: "031-000-0000",
        담당자: "",
        "담당자 직책": "",
        상태: "신규",
        등급: "C",
        태그: "",
        비고: "",
      },
    ],
    { header: HEADERS }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "template");
  XLSX.writeFile(wb, "zeropass_관공서업로드_템플릿.xlsx");
}
