"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Search, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { SchoolSummaryDoc } from "@/types";
import { Input } from "@/components/ui/Input";

/**
 * 학교 전체를 한 번에 불러오지 않고, 이름 접두어로 schools_summary를 검색해 최대 10건만 보여준다.
 * 학교가 10만 건이어도 드롭다운 하나 열 때마다 전체를 읽지 않도록 하기 위함.
 */
export function SchoolPickerInput({
  value,
  onSelect,
  placeholder = "학교명을 입력해 검색",
}: {
  value?: { id: string; name: string } | null;
  onSelect: (school: { id: string; name: string; region: string; address?: string } | null) => void;
  placeholder?: string;
}) {
  const [keyword, setKeyword] = useState(value?.name ?? "");
  const [results, setResults] = useState<SchoolSummaryDoc[]>([]);
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
            collection(db, "schools_summary"),
            where("name", ">=", keyword.trim()),
            where("name", "<=", keyword.trim() + "\uf8ff"),
            orderBy("name"),
            limit(10)
          )
        );
        setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SchoolSummaryDoc));
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
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onSelect({ id: s.id, name: s.name, region: s.region, address: s.address });
                setKeyword(s.name);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"
            >
              <span className="font-medium text-ink-900">{s.name}</span>
              <span className="ml-2 text-xs text-ink-500">{s.region}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <p className="mt-1 text-[11px] text-ink-300">검색 중...</p>}
    </div>
  );
}
