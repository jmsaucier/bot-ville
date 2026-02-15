import type { RoleDefinition } from "../policy-engine.js";

export const heel: RoleDefinition = {
  id: "HEEL",
  name: "Heel",
  description: "Watchdog. Monitors system health and raises alerts.",
  policies: [
    { action: "watchdog_alert", allowed: true },
    { action: "update_task_status", allowed: true },
  ],
  canModifyCanonical: false,
  canCompleteTasks: false,
  canCreateArtifacts: false,
};
