import { type ReactNode } from "react";
import { cn } from "@bot-ville/ui/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 text-center",
        className
      )}
    >
      {icon && <div className="mb-1 flex justify-center">{icon}</div>}
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
