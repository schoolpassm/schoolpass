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
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/copilot", label: "AI Copilot", icon: Sparkles },
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

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-pop flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border">
          <span className="text-sm font-bold text-ink-900">SchoolPass CRM</span>
          <button onClick={onClose} className="p-1 text-ink-500">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  active ? "bg-primary-50 text-primary-700" : "text-ink-500 hover:bg-surface-muted"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
