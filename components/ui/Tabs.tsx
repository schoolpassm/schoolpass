"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-surface-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active === t.key
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-ink-500 hover:text-ink-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === active)?.content}
    </div>
  );
}
