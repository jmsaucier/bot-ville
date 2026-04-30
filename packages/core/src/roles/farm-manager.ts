import type { RoleDefinition } from "../policy-engine.js";

export const farmManager: RoleDefinition = {
  id: "FARM_MANAGER",
  name: "Farm Manager",
  description:
    "Orchestrator / concierge. Creates work orders, assigns tasks, requests merges.",
  policies: [
    { action: "create_work_order", allowed: true },
    { action: "assign_task", allowed: true },
    { action: "update_task_status", allowed: true },
    { action: "request_merge", allowed: true },
    { action: "triage_task", allowed: true },
  ],
  canModifyCanonical: false,
  canCompleteTasks: true,
  canCreateArtifacts: true,
};
