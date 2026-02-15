import type { RoleId } from "@repo/shared";

// ─── Action Types ────────────────────────────────────────────────────────────

export type ActionType =
  | "create_work_order"
  | "assign_task"
  | "update_task_status"
  | "complete_task"
  | "submit_artifact"
  | "modify_canonical"
  | "request_merge"
  | "merge_git_branch"
  | "canonicalize_artifact"
  | "trigger_tick"
  | "triage_task"
  | "unblock_task"
  | "maintenance"
  | "watchdog_alert"
  | "create_user_artifact";

// ─── Policy Definition ───────────────────────────────────────────────────────

export interface Policy {
  action: ActionType;
  allowed: boolean;
  reason?: string;
}

export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  policies: Policy[];
  canModifyCanonical: boolean;
  canCompleteTasks: boolean;
  canCreateArtifacts: boolean;
}

// ─── Policy Registry ─────────────────────────────────────────────────────────

const roleRegistry = new Map<RoleId, RoleDefinition>();

export function registerRole(definition: RoleDefinition): void {
  roleRegistry.set(definition.id, definition);
}

export function getRole(roleId: RoleId): RoleDefinition | undefined {
  return roleRegistry.get(roleId);
}

export function getAllRoles(): RoleDefinition[] {
  return Array.from(roleRegistry.values());
}

// ─── Policy Enforcement ──────────────────────────────────────────────────────

export class PolicyViolationError extends Error {
  constructor(
    public readonly roleId: RoleId,
    public readonly action: ActionType,
    public readonly reason: string
  ) {
    super(`Policy violation: role "${roleId}" cannot "${action}". ${reason}`);
    this.name = "PolicyViolationError";
  }
}

/**
 * Enforce that a role is allowed to perform an action.
 * Throws PolicyViolationError if the action is not permitted.
 */
export function enforcePolicy(action: ActionType, roleId: RoleId): void {
  const role = roleRegistry.get(roleId);
  if (!role) {
    throw new PolicyViolationError(
      roleId,
      action,
      `Role "${roleId}" is not registered.`
    );
  }

  // Check specific action policies
  const policy = role.policies.find((p) => p.action === action);
  if (policy && !policy.allowed) {
    throw new PolicyViolationError(
      roleId,
      action,
      policy.reason ?? `Action "${action}" is explicitly denied for role "${roleId}".`
    );
  }

  // Check broad capability flags
  if (action === "modify_canonical" && !role.canModifyCanonical) {
    throw new PolicyViolationError(
      roleId,
      action,
      "This role cannot modify canonical artifacts."
    );
  }

  if (action === "complete_task" && !role.canCompleteTasks) {
    throw new PolicyViolationError(
      roleId,
      action,
      "This role cannot complete tasks."
    );
  }

  if (
    (action === "submit_artifact" || action === "create_user_artifact") &&
    !role.canCreateArtifacts
  ) {
    throw new PolicyViolationError(
      roleId,
      action,
      "This role cannot create user-facing artifacts."
    );
  }

  // If no explicit deny and no flag violation, action is allowed
}

/**
 * Check if a role can perform an action (non-throwing version).
 */
export function canPerform(action: ActionType, roleId: RoleId): boolean {
  try {
    enforcePolicy(action, roleId);
    return true;
  } catch {
    return false;
  }
}
