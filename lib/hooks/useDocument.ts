"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useFirestoreDoc<T = DocumentData>(path: string | null, docId: string | null) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path || !docId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, path, docId),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as T & { id: string }) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [path, docId]);

  return { data, loading, error };
}
