"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Search, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { InstitutionDoc } from "@/types";
import { Input } from "@/components/ui/Input";

/**
 * ZeroPass 통합 확장(2026.10) — SchoolPickerInput과 동일한 패턴의 기관(institutions) 검색 선택기.
 * 계약 등록 화면에서 "학교 계약"이 아니라 "관공서/민간기업 등 계약"을 기록할 때 쓴다.
 */
export function InstitutionPickerInput({
  value,
  onSelect,
  placeholder = "기관명을 입력해 검색",
}: {
  value?: { id: string; name: string } | null;
  onSelect: (institution: { id: string; name: string; region: string } | null) => void;
  placeholder?: string;
}) {
  const [keyword, setKeyword] = useState(value?.name ?? "");
  const [results, setResults] = useState<InstitutionDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keyword.trim() || (value && keyword === value.name)) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "institutions"),
            where("name", ">=", keyword.trim()),
            where("name", "<=", keyword.trim() + ""),
            orderBy("name"),
            limit(10)
          )
        );
        setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InstitutionDoc));
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
        <Input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            if (value) onSelect(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              onSelect(null);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-surface-border bg-white shadow-pop max-h-56 overflow-y-auto">
          {results.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => {
                onSelect({ id: i.id, name: i.name, region: i.region });
                setKeyword(i.name);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"
            >
              <span className="font-medium text-ink-900">{i.name}</span>
              <span className="ml-2 text-xs text-ink-500">
                {i.type} · {i.region}
              </span>
            </button>
          ))}
        </div>
      )}
      {loading && <p className="mt-1 text-[11px] text-ink-300">검색 중...</p>}
    </div>
  );
}
