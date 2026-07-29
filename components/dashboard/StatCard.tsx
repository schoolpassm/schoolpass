import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent = "primary",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  suffix?: string;
  accent?: "primary" | "green" | "amber" | "violet";
  href?: string;
}) {
  const accentMap = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  const content = (
    <Card className={cn("p-4", href && "transition-shadow hover:shadow-pop cursor-pointer")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-ink-900">
            {value}
            {suffix && <span className="ml-1 text-sm font-medium text-ink-500">{suffix}</span>}
          </p>
        </div>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentMap[accent])}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
