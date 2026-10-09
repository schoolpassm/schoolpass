"use client";

import { useRef, useState } from "react";
import { orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Upload, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { useCollection } from "@/lib/hooks/useCollection";
import { SchoolFileCategory, SchoolFileDoc } from "@/types";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  brochure: "브로슈어",
  photo: "사진",
  proposal: "제안서",
  contract: "계약서",
  demo_material: "시연자료",
  etc: "기타",
};

/** schoolId를 주면 기존처럼 schools/ 하위 Storage 경로 + schools_detail 컬렉션을,
 * basePath/storagePrefix/categories를 주면 그 경로(예: institutions)를 쓴다.
 * ZeroPass 통합 확장(2026.10)에서 institutions 상세페이지의 첨부파일 탭에 그대로 재사용하기 위해 범용화. */
/** 지시서 5번(institutions의 "제안서·소개서·시연자료")을 포함하려고 schools보다 넓은
 * 카테고리 문자열을 받을 수 있게 느슨한 타입으로 둔다 — schools 쪽 호출은 그대로 동작. */
type FileCategory = SchoolFileCategory | "demo_material";

export function FilesTab({
  schoolId,
  basePath,
  storagePrefix,
  categories,
}: {
  schoolId?: string;
  basePath?: string;
  storagePrefix?: string;
  categories?: FileCategory[];
}) {
  const path = basePath ?? `schools_detail/${schoolId}`;
  const prefix = storagePrefix ?? `schools/${schoolId}`;
  const categoryOptions = categories ?? (["brochure", "photo", "proposal", "contract", "etc"] as FileCategory[]);
  const { data: files, loading } = useCollection<SchoolFileDoc>(`${path}/files`, [orderBy("createdAt", "desc")]);
  const { firebaseUser } = useAuth();
  const [category, setCategory] = useState<FileCategory>(categoryOptions[0]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploading(true);
    try {
      const storagePath = `${prefix}/${category}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, path, "files"), {
        category,
        fileName: file.name,
        url,
        storagePath,
        sizeBytes: file.size,
        uploadedByUid: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-surface-muted p-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FileCategory)}
          className="h-9 rounded-lg border border-surface-border bg-white px-2 text-xs"
        >
          {categoryOptions.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABEL[k] ?? k}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> {uploading ? "업로드 중..." : "파일 업로드"}
        </Button>
        <input ref={inputRef} type="file" hidden onChange={handleUpload} />
        <span className="text-[11px] text-ink-300">사진, PDF, 브로슈어 등 (자동 저장)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {loading && <p className="col-span-full text-xs text-ink-300">불러오는 중...</p>}
        {!loading && files.length === 0 && (
          <p className="col-span-full rounded-lg border border-dashed border-surface-border py-8 text-center text-xs text-ink-300">
            업로드된 파일이 없습니다.
          </p>
        )}
        {files.map((f) => (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col overflow-hidden rounded-lg border border-surface-border bg-white"
          >
            {f.category === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt={f.fileName} className="h-24 w-full object-cover" />
            ) : (
              <div className="flex h-24 w-full items-center justify-center bg-surface-muted text-ink-300">
                {f.category === "brochure" || f.category === "proposal" ? <FileText size={24} /> : <FileIcon size={24} />}
              </div>
            )}
            <div className="p-2">
              <p className={cn("truncate text-[11px] font-medium text-ink-700")}>{f.fileName}</p>
              <p className="text-[10px] text-ink-300">{CATEGORY_LABEL[f.category]}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
