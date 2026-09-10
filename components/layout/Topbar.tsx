"use client";

import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { MobileNav } from "./MobileNav";

export function Topbar({ title }: { title: string }) {
  const { signOut, userDoc } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-border bg-white/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button
          className="rounded-md p-2 text-ink-700 hover:bg-surface-muted lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-bold text-ink-900 lg:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            placeholder="학교, 교육지원청, 파트너 검색"
            className="h-9 w-64 rounded-lg border border-surface-border bg-surface-muted pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <button className="rounded-md p-2 text-ink-500 hover:bg-surface-muted">
          <Bell size={18} />
        </button>
        {/* 로그인한 사람 이름 — 모바일에서도 항상 보이게 (예전엔 hover 툴팁으로만 있어서 폰에서 안 보였음) */}
        <span className="hidden items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-700 sm:flex">
          {userDoc?.name ?? "게스트"}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 sm:hidden">
          {(userDoc?.name ?? "?").slice(0, 1)}
        </span>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-500 hover:bg-surface-muted"
          title={userDoc?.email}
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
