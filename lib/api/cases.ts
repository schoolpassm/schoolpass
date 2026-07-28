import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { CaseDoc } from "@/types";

export async function createCase(
  input: Omit<CaseDoc, "id" | "createdAt" | "updatedAt" | "photos" | "fileUrls">,
  photoFiles: File[],
  pdfFiles: File[],
  uid: string
) {
  const caseId = crypto.randomUUID();

  const photos = await Promise.all(
    photoFiles.map(async (f) => {
      const path = `cases/${caseId}/photos/${Date.now()}_${f.name}`;
      await uploadBytes(ref(storage, path), f);
      return getDownloadURL(ref(storage, path));
    })
  );

  const fileUrls = await Promise.all(
    pdfFiles.map(async (f) => {
      const path = `cases/${caseId}/files/${Date.now()}_${f.name}`;
      await uploadBytes(ref(storage, path), f);
      return getDownloadURL(ref(storage, path));
    })
  );

  return addDoc(collection(db, "cases"), {
    ...input,
    photos,
    fileUrls,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
}
