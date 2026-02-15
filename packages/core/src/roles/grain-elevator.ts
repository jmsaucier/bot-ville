import type { RoleDefinition } from "../policy-engine.js";

export const grainElevator: RoleDefinition = {
  id: "GRAIN_ELEVATOR",
  name: "Grain Elevator",
  description:
    "Merge gate + canonicalization. Merges drafts into canonical output.",
  policies: [
    { action: "canonicalize_artifact", allowed: true },
    { action: "request_merge", allowed: true },
    { action: "modify_canonical", allowed: true },
    { action: "update_task_status", allowed: true },
  ],
  canModifyCanonical: true,
  canCompleteTasks: true,
  canCreateArtifacts: true,
};
