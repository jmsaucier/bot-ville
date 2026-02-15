import type { RoleDefinition } from "../policy-engine.js";

export const barnDog: RoleDefinition = {
  id: "BARN_DOG",
  name: "Barn Dog",
  description: "Maintenance agent. Performs background maintenance tasks.",
  policies: [
    { action: "maintenance", allowed: true },
    { action: "update_task_status", allowed: true },
  ],
  canModifyCanonical: false,
  canCompleteTasks: false,
  canCreateArtifacts: false,
};
