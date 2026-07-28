"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  School,
  Building2,
  PhoneCall,
  Users,
  FolderKanban,
  FileSignature,
  BarChart3,
  Settings,
  CalendarDays,
  FolderOpen,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/schools", label: "학교관리", icon: School },
  { href: "/education-offices", label: "교육지원청", icon: Building2 },
  { href: "/sales", label: "영업관리", icon: PhoneCall },
  { href: "/partners", label: "파트너관리", icon: Users },
  { href: "/cases", label: "구축사례", icon: FolderKanban },
  { href: "/contracts", label: "계약관리", icon: FileSignature },
  { href: "/schedule", label: "일정관리", icon: CalendarDays },
  { href: "/files", label: "파일관리", icon: FolderOpen },
  { href: "/stats", label: "통계", icon: BarChart3 },
  { href: "/settings", label: "관리자", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { userDoc } = useAuth();

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-surface-border bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500 text-white">
          <ShieldCheck size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-ink-900 leading-tight">SchoolPass</p>
          <p className="text-[11px] text-ink-500 leading-tight">영업 CRM</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-ink-500 hover:bg-surface-muted hover:text-ink-900"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 mt-2 rounded-lg bg-surface-muted p-3">
        <p className="text-xs font-semibold text-ink-900">{userDoc?.name ?? "게스트"}</p>
        <p className="text-[11px] text-ink-500">
          {userDoc?.role === "admin" ? "관리자" : userDoc?.role === "partner" ? "파트너" : "매니저"}
        </p>
      </div>
    </aside>
  );
}
