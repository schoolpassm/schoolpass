"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Upload, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useCollection } from "@/lib/hooks/useCollection";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/utils";
import { SchoolFileCategory } from "@/types";

interface GeneralFileDoc {
  id: string;
  category: SchoolFileCategory;
  fileName: string;
  url: string;
  createdAt: any;
  uploadedByName: string;
}

const CATEGORY_LABEL: Record<SchoolFileCategory, string> = {
  brochure: "브로슈어",
  proposal: "제안서",
  photo: "사진",
  contract: "계약서",
  etc: "기타(PDF 등)",
};

export default function FilesPage() {
  const { data: files, loading } = useCollection<GeneralFileDoc>("files", [orderBy("createdAt", "desc")]);
  const { firebaseUser, userDoc } = useAuth();
  const [category, setCategory] = useState<SchoolFileCategory>("brochure");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploading(true);
    try {
      const path = `company-files/${category}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, "files"), {
        category,
        fileName: file.name,
        url,
        storagePath: path,
        uploadedByUid: firebaseUser.uid,
        uploadedByName: userDoc?.name ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <AppShell title="파일관리">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-surface-border bg-white p-3 shadow-card">
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
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> {uploading ? "업로드 중..." : "파일 업로드"}
        </Button>
        <input ref={inputRef} type="file" hidden onChange={handleUpload} />
        <span className="text-[11px] text-ink-300">전사 공용 브로슈어·제안서·사진·PDF 보관함 (업로드 시 자동 저장)</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {loading && <p className="col-span-full text-xs text-ink-300">불러오는 중...</p>}
        {files.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-white">
            <div className="flex h-24 w-full items-center justify-center bg-surface-muted text-ink-300">
              {f.category === "photo" ? <ImageIcon size={22} /> : f.category === "brochure" || f.category === "proposal" ? <FileText size={22} /> : <FileIcon size={22} />}
            </div>
            <div className="p-2">
              <p className="truncate text-[11px] font-medium text-ink-700">{f.fileName}</p>
              <p className="text-[10px] text-ink-300">{CATEGORY_LABEL[f.category]} · {formatDate(f.createdAt)}</p>
            </div>
          </a>
        ))}
        {files.length === 0 && !loading && (
          <p className="col-span-full rounded-lg border border-dashed border-surface-border py-16 text-center text-sm text-ink-300">
            업로드된 파일이 없습니다.
          </p>
        )}
      </div>
    </AppShell>
  );
}
