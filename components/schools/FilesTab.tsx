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

const CATEGORY_LABEL: Record<SchoolFileCategory, string> = {
  brochure: "브로슈어",
  photo: "사진",
  proposal: "제안서",
  contract: "계약서",
  etc: "기타",
};

export function FilesTab({ schoolId }: { schoolId: string }) {
  const { data: files, loading } = useCollection<SchoolFileDoc>(`schools/${schoolId}/files`, [
    orderBy("createdAt", "desc"),
  ]);
  const { firebaseUser } = useAuth();
  const [category, setCategory] = useState<SchoolFileCategory>("photo");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploading(true);
    try {
      const storagePath = `schools/${schoolId}/${category}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "schools", schoolId, "files"), {
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
          onChange={(e) => setCategory(e.target.value as SchoolFileCategory)}
          className="h-9 rounded-lg border border-surface-border bg-white px-2 text-xs"
        >
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
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
