import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  suffix?: string;
  accent?: "primary" | "green" | "amber" | "violet";
}) {
  const accentMap = {
    primary: "bg-primary-50 text-primary-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="p-4">
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
}
