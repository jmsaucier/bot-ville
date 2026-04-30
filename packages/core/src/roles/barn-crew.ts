import type { RoleDefinition } from "../policy-engine.js";

export const barnCrew: RoleDefinition = {
  id: "BARN_CREW",
  name: "Barn Crew",
  description: "Persistent specialists. Long-running domain-specific agents.",
  policies: [
    { action: "update_task_status", allowed: true },
    { action: "submit_artifact", allowed: true },
  ],
  canModifyCanonical: false,
  canCompleteTasks: true,
  canCreateArtifacts: true,
};
