import type { RoleDefinition } from "../policy-engine.js";

export const fieldHand: RoleDefinition = {
  id: "FIELD_HAND",
  name: "Field Hand",
  description:
    "Executor. Works tasks and submits draft artifacts. Cannot modify canonical artifacts.",
  policies: [
    { action: "update_task_status", allowed: true },
    { action: "submit_artifact", allowed: true },
    {
      action: "modify_canonical",
      allowed: false,
      reason: "Field Hands cannot directly modify canonical artifacts.",
    },
  ],
  canModifyCanonical: false,
  canCompleteTasks: true,
  canCreateArtifacts: true,
};
