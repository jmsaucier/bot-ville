"use client";

import { cn } from "@repo/ui/lib/utils";

const ROLE_ICONS: Record<string, string> = {
  FARM_MANAGER: "FM",
  FIELD_HAND: "FH",
  FIELD_SCOUT: "FS",
  GRAIN_ELEVATOR: "GE",
  BELL_RINGER: "BR",
  BARN_DOG: "BD",
  HEEL: "HL",
  BARN_CREW: "BC",
};

const ROLE_COLORS: Record<string, string> = {
  FARM_MANAGER: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  FIELD_HAND: "bg-green-500/20 text-green-400 border-green-500/50",
  FIELD_SCOUT: "bg-amber-500/20 text-amber-400 border-amber-500/50",
  GRAIN_ELEVATOR: "bg-purple-500/20 text-purple-400 border-purple-500/50",
  BELL_RINGER: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  BARN_DOG: "bg-teal-500/20 text-teal-400 border-teal-500/50",
  HEEL: "bg-red-500/20 text-red-400 border-red-500/50",
  BARN_CREW: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
};

export function RoleAvatar({
  roleId,
  size = "md",
  className,
}: {
  roleId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = ROLE_ICONS[roleId] ?? roleId.slice(0, 2);
  const colorClass =
    ROLE_COLORS[roleId] ?? "bg-gray-500/20 text-gray-400 border-gray-500/50";

  const sizeClass = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold",
        sizeClass,
        colorClass,
        className
      )}
      title={roleId}
    >
      {initials}
    </div>
  );
}
