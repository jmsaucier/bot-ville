"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@bot-ville/ui/lib/utils";

export function EventCard({
  eventType,
  timestamp,
  children,
  className,
}: {
  eventType: string;
  timestamp: string;
  children?: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/50 cursor-pointer",
        className
      )}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary">{eventType}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
      {expanded && children && (
        <div className="mt-2 rounded bg-background p-2 text-xs font-mono overflow-auto max-h-64">
          {children}
        </div>
      )}
    </div>
  );
}
