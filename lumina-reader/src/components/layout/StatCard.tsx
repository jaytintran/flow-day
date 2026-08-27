import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  value,
  label,
  colorClass,
  active,
  onClick,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  colorClass: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all",
        onClick && "cursor-pointer hover:border-primary/50 hover:bg-card/80 active:scale-[0.98]",
        active && "border-primary bg-primary/10 ring-1 ring-primary",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
          colorClass,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}
