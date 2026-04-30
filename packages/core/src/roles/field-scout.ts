import type { RoleDefinition } from "../policy-engine.js";

export const fieldScout: RoleDefinition = {
  id: "FIELD_SCOUT",
  name: "Field Scout",
  description:
    "Triage / unblock. Can unblock tasks and change status. Cannot complete tasks.",
  policies: [
    { action: "triage_task", allowed: true },
    { action: "unblock_task", allowed: true },
    { action: "update_task_status", allowed: true },
    {
      action: "complete_task",
      allowed: false,
      reason: "Scout can only triage/unblock; cannot complete tasks.",
    },
  ],
  canModifyCanonical: false,
  canCompleteTasks: false,
  canCreateArtifacts: false,
};
