import { z } from "zod";

export const RoleIdEnum = z.enum([
  "FARM_MANAGER",
  "FIELD_HAND",
  "FIELD_SCOUT",
  "GRAIN_ELEVATOR",
  "BELL_RINGER",
  "BARN_DOG",
  "HEEL",
  "BARN_CREW",
]);

export type RoleId = z.infer<typeof RoleIdEnum>;

/** Human-readable display names for each role */
export const ROLE_DISPLAY_NAMES: Record<RoleId, string> = {
  FARM_MANAGER: "Farm Manager",
  FIELD_HAND: "Field Hand",
  FIELD_SCOUT: "Field Scout",
  GRAIN_ELEVATOR: "Grain Elevator",
  BELL_RINGER: "Bell Ringer",
  BARN_DOG: "Barn Dog",
  HEEL: "Heel",
  BARN_CREW: "Barn Crew",
};

/** Brief descriptions of each role */
export const ROLE_DESCRIPTIONS: Record<RoleId, string> = {
  FARM_MANAGER:
    "Orchestrator / concierge. Creates work orders, assigns tasks, requests merges.",
  FIELD_HAND:
    "Executor. Works tasks and submits draft artifacts. Cannot modify canonical artifacts.",
  FIELD_SCOUT:
    "Triage / unblock. Can unblock tasks and change status. Cannot complete tasks.",
  GRAIN_ELEVATOR:
    "Merge gate + canonicalization. Merges drafts into canonical output.",
  BELL_RINGER:
    "Cadence daemon. Triggers ticks. Does not create user-facing artifacts.",
  BARN_DOG: "Maintenance agent. Performs background maintenance tasks.",
  HEEL: "Watchdog. Monitors system health and raises alerts.",
  BARN_CREW: "Persistent specialists. Long-running domain-specific agents.",
};
