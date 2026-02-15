import type { RoleDefinition } from "../policy-engine.js";

export const bellRinger: RoleDefinition = {
  id: "BELL_RINGER",
  name: "Bell Ringer",
  description:
    "Cadence daemon. Triggers ticks. Does not create user-facing artifacts.",
  policies: [
    { action: "trigger_tick", allowed: true },
    {
      action: "submit_artifact",
      allowed: false,
      reason: "Bell Ringer only triggers cadence; it doesn't create user-facing artifacts.",
    },
    {
      action: "create_user_artifact",
      allowed: false,
      reason: "Bell Ringer only triggers cadence; it doesn't create user-facing artifacts.",
    },
  ],
  canModifyCanonical: false,
  canCompleteTasks: false,
  canCreateArtifacts: false,
};
