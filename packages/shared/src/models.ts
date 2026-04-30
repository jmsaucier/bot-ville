import { z } from "zod";
import { StatusEnum } from "./statuses.js";
import { RoleIdEnum } from "./roles.js";

// ─── WorkOrder ───────────────────────────────────────────────────────────────

export const WorkOrderSchema = z.object({
  id: z.string().uuid(),
  goal: z.string().min(1),
  context: z.record(z.unknown()).optional().default({}),
  status: StatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;

export const CreateWorkOrderInput = z.object({
  goal: z.string().min(1),
  context: z.record(z.unknown()).optional(),
});

export type CreateWorkOrderInputType = z.infer<typeof CreateWorkOrderInput>;

// ─── Task ────────────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: StatusEnum,
  ownerRole: RoleIdEnum.nullable().default(null),
  deps: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInput = z.object({
  workOrderId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  deps: z.array(z.string().uuid()).optional().default([]),
});

export type CreateTaskInputType = z.infer<typeof CreateTaskInput>;

// ─── Artifact ────────────────────────────────────────────────────────────────

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  content: z.string(),
  createdByRole: RoleIdEnum,
  linkedTaskId: z.string().uuid().nullable().default(null),
  workOrderId: z.string().uuid(),
  version: z.number().int().positive().default(1),
  canonical: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const ArtifactDraftInput = z.object({
  type: z.string().min(1),
  content: z.string(),
  linkedTaskId: z.string().uuid().nullable().optional(),
  workOrderId: z.string().uuid(),
});

export type ArtifactDraftInputType = z.infer<typeof ArtifactDraftInput>;

// ─── Decision ────────────────────────────────────────────────────────────────

export const DecisionSchema = z.object({
  id: z.string().uuid(),
  summary: z.string().min(1),
  rationale: z.string().default(""),
  role: RoleIdEnum,
  linkedTaskId: z.string().uuid().nullable().default(null),
  workOrderId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type Decision = z.infer<typeof DecisionSchema>;

// ─── EventLog ────────────────────────────────────────────────────────────────

export const EventLogSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  role: RoleIdEnum.nullable().default(null),
  action: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  correlationId: z.string().uuid().nullable().default(null),
  workOrderId: z.string().uuid().nullable().default(null),
});

export type EventLog = z.infer<typeof EventLogSchema>;

// ─── Snapshot (aggregate read model) ─────────────────────────────────────────

export const WorkOrderSnapshotSchema = z.object({
  workOrder: WorkOrderSchema,
  tasks: z.array(TaskSchema),
  artifacts: z.array(ArtifactSchema),
  decisions: z.array(DecisionSchema),
  events: z.array(EventLogSchema),
});

export type WorkOrderSnapshot = z.infer<typeof WorkOrderSnapshotSchema>;
