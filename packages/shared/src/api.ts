import { z } from "zod";
import { RoleIdEnum } from "./roles.js";
import {
  WorkOrderSchema,
  TaskSchema,
  ArtifactSchema,
  EventLogSchema,
  WorkOrderSnapshotSchema,
} from "./models.js";

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const CreateWorkOrderRequest = z.object({
  goal: z.string().min(1),
  context: z.record(z.unknown()).optional(),
});
export type CreateWorkOrderRequestType = z.infer<typeof CreateWorkOrderRequest>;

export const AssignTaskRequest = z.object({
  roleId: RoleIdEnum,
});
export type AssignTaskRequestType = z.infer<typeof AssignTaskRequest>;

export const SubmitArtifactRequest = z.object({
  type: z.string().min(1),
  content: z.string(),
  roleId: RoleIdEnum,
  workOrderId: z.string().uuid(),
});
export type SubmitArtifactRequestType = z.infer<typeof SubmitArtifactRequest>;

export const RequestMergeRequest = z.object({
  artifactType: z.string().min(1),
});
export type RequestMergeRequestType = z.infer<typeof RequestMergeRequest>;

export const TickRequest = z.object({}).optional();
export type TickRequestType = z.infer<typeof TickRequest>;

// ─── Response Schemas ────────────────────────────────────────────────────────

export const WorkOrderResponse = WorkOrderSchema;
export type WorkOrderResponseType = z.infer<typeof WorkOrderResponse>;

export const WorkOrderListResponse = z.array(WorkOrderSchema);
export type WorkOrderListResponseType = z.infer<typeof WorkOrderListResponse>;

export const TaskResponse = TaskSchema;
export type TaskResponseType = z.infer<typeof TaskResponse>;

export const TaskListResponse = z.array(TaskSchema);
export type TaskListResponseType = z.infer<typeof TaskListResponse>;

export const ArtifactResponse = ArtifactSchema;
export type ArtifactResponseType = z.infer<typeof ArtifactResponse>;

export const ArtifactListResponse = z.array(ArtifactSchema);
export type ArtifactListResponseType = z.infer<typeof ArtifactListResponse>;

export const SnapshotResponse = WorkOrderSnapshotSchema;
export type SnapshotResponseType = z.infer<typeof SnapshotResponse>;

export const EventLogListResponse = z.array(EventLogSchema);
export type EventLogListResponseType = z.infer<typeof EventLogListResponse>;

export const MergeResultResponse = z.object({
  success: z.boolean(),
  canonicalArtifactId: z.string().uuid().nullable(),
  conflictReport: z.string().nullable().default(null),
  affectedTaskIds: z.array(z.string().uuid()).default([]),
});
export type MergeResultResponseType = z.infer<typeof MergeResultResponse>;

export const TickResultResponse = z.object({
  tickNumber: z.number().int(),
  bellRinger: z.object({ triggered: z.boolean() }),
  scout: z.object({
    triaged: z.number().int(),
    unblocked: z.number().int(),
  }),
  dogs: z.object({ maintenanceActions: z.number().int() }),
  heel: z.object({ alerts: z.number().int() }),
});
export type TickResultResponseType = z.infer<typeof TickResultResponse>;

export const HealthResponse = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  uptime: z.number(),
  workOrderCount: z.number().int(),
  activeTaskCount: z.number().int(),
  blockedTaskCount: z.number().int(),
  lastTick: z.string().datetime().nullable(),
});
export type HealthResponseType = z.infer<typeof HealthResponse>;

// ─── Event Query Params ──────────────────────────────────────────────────────

export const EventQueryParams = z.object({
  workOrderId: z.string().uuid().optional(),
  role: RoleIdEnum.optional(),
  action: z.string().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type EventQueryParamsType = z.infer<typeof EventQueryParams>;
