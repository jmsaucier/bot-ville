"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@bot-ville/ui/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
  {
    variants: {
      status: {
        NEW: "border-blue-400/50 bg-blue-400/10 text-blue-400",
        ASSIGNED: "border-violet-400/50 bg-violet-400/10 text-violet-400",
        IN_PROGRESS: "border-amber-400/50 bg-amber-400/10 text-amber-400",
        BLOCKED: "border-red-400/50 bg-red-400/10 text-red-400",
        REVIEW: "border-orange-400/50 bg-orange-400/10 text-orange-400",
        MERGED: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400",
        DONE: "border-green-500/50 bg-green-500/10 text-green-500",
        FAILED: "border-red-600/50 bg-red-600/10 text-red-600",
      },
    },
    defaultVariants: {
      status: "NEW",
    },
  }
);

type StatusVariant = NonNullable<
  VariantProps<typeof statusBadgeVariants>["status"]
>;

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const variant = (
    [
      "NEW",
      "ASSIGNED",
      "IN_PROGRESS",
      "BLOCKED",
      "REVIEW",
      "MERGED",
      "DONE",
      "FAILED",
    ] as StatusVariant[]
  ).includes(status as StatusVariant)
    ? (status as StatusVariant)
    : "NEW";

  return (
    <span className={cn(statusBadgeVariants({ status: variant }), className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
