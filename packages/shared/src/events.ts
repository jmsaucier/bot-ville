import { z } from "zod";
import { RoleIdEnum } from "./roles.js";
import { StatusEnum } from "./statuses.js";
import { AgentSessionStatusEnum } from "./agents.js";
import { GitMergeRequestStatusEnum } from "./merge-request.js";

// ─── Event Type Enum ─────────────────────────────────────────────────────────

export const EventTypeEnum = z.enum([
  "workorder.created",
  "task.created",
  "task.assigned",
  "task.status_changed",
  "artifact.submitted",
  "artifact.canonicalized",
  "merge.requested",
  "merge.conflict",
  "merge.completed",
  "merge.git_requested",
  "merge.git_completed",
  "merge.git_conflict",
  "cadence.tick",
  "scout.triage",
  "dogs.maintenance",
  "heel.watchdog_alert",
  "decision.recorded",
  "system.error",
  "agent.spawned",
  "agent.connected",
  "agent.heartbeat",
  "agent.completed",
  "agent.failed",
  "agent.killed",
  "project.changed",
]);

export type EventType = z.infer<typeof EventTypeEnum>;

// ─── Per-event Payload Schemas ───────────────────────────────────────────────

export const WorkOrderCreatedPayload = z.object({
  workOrderId: z.string().uuid(),
  goal: z.string(),
});

export const TaskCreatedPayload = z.object({
  taskId: z.string().uuid(),
  workOrderId: z.string().uuid(),
  title: z.string(),
});

export const TaskAssignedPayload = z.object({
  taskId: z.string().uuid(),
  roleId: RoleIdEnum,
});

export const TaskStatusChangedPayload = z.object({
  taskId: z.string().uuid(),
  fromStatus: StatusEnum,
  toStatus: StatusEnum,
  reason: z.string().optional(),
});

export const ArtifactSubmittedPayload = z.object({
  artifactId: z.string().uuid(),
  taskId: z.string().uuid().nullable(),
  type: z.string(),
  roleId: RoleIdEnum,
});

export const ArtifactCanonicalizedPayload = z.object({
  artifactId: z.string().uuid(),
  workOrderId: z.string().uuid(),
  type: z.string(),
});

export const MergeRequestedPayload = z.object({
  workOrderId: z.string().uuid(),
  artifactType: z.string(),
  artifactIds: z.array(z.string().uuid()),
});

export const MergeConflictPayload = z.object({
  workOrderId: z.string().uuid(),
  artifactType: z.string(),
  conflictReport: z.string(),
  affectedTaskIds: z.array(z.string().uuid()),
});

export const MergeCompletedPayload = z.object({
  workOrderId: z.string().uuid(),
  artifactType: z.string(),
  canonicalArtifactId: z.string().uuid(),
});

// ─── Git Merge Event Payloads ───────────────────────────────────────────────

export const GitMergeRequestedPayload = z.object({
  mergeRequestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  roleId: RoleIdEnum,
  workOrderId: z.string().uuid().nullable(),
});

export const GitMergeCompletedPayload = z.object({
  mergeRequestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  status: GitMergeRequestStatusEnum,
});

export const GitMergeConflictPayload = z.object({
  mergeRequestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  conflictFiles: z.array(z.string()),
});

export const CadenceTickPayload = z.object({
  tickNumber: z.number().int(),
  timestamp: z.string().datetime(),
  summary: z.string().optional(),
});

export const ScoutTriagePayload = z.object({
  taskId: z.string().uuid(),
  action: z.string(),
  resolution: z.string().optional(),
});

export const DogsMaintenancePayload = z.object({
  action: z.string(),
  details: z.string().optional(),
});

export const HeelWatchdogAlertPayload = z.object({
  alertType: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string(),
  affectedEntities: z.array(z.string()).optional(),
});

export const DecisionRecordedPayload = z.object({
  decisionId: z.string().uuid(),
  summary: z.string(),
  linkedTaskId: z.string().uuid().nullable(),
});

export const SystemErrorPayload = z.object({
  error: z.string(),
  context: z.record(z.unknown()).optional(),
});

// ─── Agent Event Payloads ───────────────────────────────────────────────────

export const AgentSpawnedPayload = z.object({
  sessionId: z.string().uuid(),
  agentPresetId: z.string(),
  roleId: RoleIdEnum,
  workOrderId: z.string().uuid().nullable(),
  taskId: z.string().uuid().nullable(),
  pid: z.number().int().nullable(),
});

export const AgentConnectedPayload = z.object({
  sessionId: z.string().uuid(),
  agentPresetId: z.string(),
  roleId: RoleIdEnum,
});

export const AgentHeartbeatPayload = z.object({
  sessionId: z.string().uuid(),
  message: z.string().optional(),
});

export const AgentCompletedPayload = z.object({
  sessionId: z.string().uuid(),
  agentPresetId: z.string(),
  roleId: RoleIdEnum,
  message: z.string().optional(),
});

export const AgentFailedPayload = z.object({
  sessionId: z.string().uuid(),
  agentPresetId: z.string(),
  roleId: RoleIdEnum,
  error: z.string(),
  exitCode: z.number().int().nullable(),
});

export const AgentKilledPayload = z.object({
  sessionId: z.string().uuid(),
  agentPresetId: z.string(),
  roleId: RoleIdEnum,
  reason: z.string().optional(),
});

// ─── Project Event Payloads ─────────────────────────────────────────────────

export const ProjectChangedPayload = z.object({
  projectDirectory: z.string(),
  projectName: z.string(),
});

// ─── Discriminated Event Union ───────────────────────────────────────────────

export const FarmEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("workorder.created"),
    payload: WorkOrderCreatedPayload,
  }),
  z.object({
    type: z.literal("task.created"),
    payload: TaskCreatedPayload,
  }),
  z.object({
    type: z.literal("task.assigned"),
    payload: TaskAssignedPayload,
  }),
  z.object({
    type: z.literal("task.status_changed"),
    payload: TaskStatusChangedPayload,
  }),
  z.object({
    type: z.literal("artifact.submitted"),
    payload: ArtifactSubmittedPayload,
  }),
  z.object({
    type: z.literal("artifact.canonicalized"),
    payload: ArtifactCanonicalizedPayload,
  }),
  z.object({
    type: z.literal("merge.requested"),
    payload: MergeRequestedPayload,
  }),
  z.object({
    type: z.literal("merge.conflict"),
    payload: MergeConflictPayload,
  }),
  z.object({
    type: z.literal("merge.completed"),
    payload: MergeCompletedPayload,
  }),
  z.object({
    type: z.literal("merge.git_requested"),
    payload: GitMergeRequestedPayload,
  }),
  z.object({
    type: z.literal("merge.git_completed"),
    payload: GitMergeCompletedPayload,
  }),
  z.object({
    type: z.literal("merge.git_conflict"),
    payload: GitMergeConflictPayload,
  }),
  z.object({
    type: z.literal("cadence.tick"),
    payload: CadenceTickPayload,
  }),
  z.object({
    type: z.literal("scout.triage"),
    payload: ScoutTriagePayload,
  }),
  z.object({
    type: z.literal("dogs.maintenance"),
    payload: DogsMaintenancePayload,
  }),
  z.object({
    type: z.literal("heel.watchdog_alert"),
    payload: HeelWatchdogAlertPayload,
  }),
  z.object({
    type: z.literal("decision.recorded"),
    payload: DecisionRecordedPayload,
  }),
  z.object({
    type: z.literal("system.error"),
    payload: SystemErrorPayload,
  }),
  z.object({
    type: z.literal("agent.spawned"),
    payload: AgentSpawnedPayload,
  }),
  z.object({
    type: z.literal("agent.connected"),
    payload: AgentConnectedPayload,
  }),
  z.object({
    type: z.literal("agent.heartbeat"),
    payload: AgentHeartbeatPayload,
  }),
  z.object({
    type: z.literal("agent.completed"),
    payload: AgentCompletedPayload,
  }),
  z.object({
    type: z.literal("agent.failed"),
    payload: AgentFailedPayload,
  }),
  z.object({
    type: z.literal("agent.killed"),
    payload: AgentKilledPayload,
  }),
  z.object({
    type: z.literal("project.changed"),
    payload: ProjectChangedPayload,
  }),
]);

export type FarmEvent = z.infer<typeof FarmEventSchema>;

// ─── Wire Event (includes metadata for transmission) ─────────────────────────

export const WireEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  role: RoleIdEnum.nullable().default(null),
  correlationId: z.string().uuid().nullable().default(null),
  workOrderId: z.string().uuid().nullable().default(null),
  event: FarmEventSchema,
});

export type WireEvent = z.infer<typeof WireEventSchema>;
