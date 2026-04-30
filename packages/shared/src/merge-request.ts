import { z } from "zod";
import { RoleIdEnum } from "./roles.js";

// ─── Merge Request Status ───────────────────────────────────────────────────

export const GitMergeRequestStatusEnum = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "MERGED",
  "CONFLICT",
  "REJECTED",
]);

export type GitMergeRequestStatus = z.infer<typeof GitMergeRequestStatusEnum>;

// ─── Git Merge Request ──────────────────────────────────────────────────────

export const GitMergeRequestSchema = z.object({
  /** Unique merge request identifier */
  id: z.string().uuid(),
  /** The agent session that produced this branch */
  sessionId: z.string().uuid(),
  /** The git branch containing the agent's work */
  sourceBranch: z.string().min(1),
  /** The branch to merge into (defaults to "main") */
  targetBranch: z.string().min(1).default("main"),
  /** The role that performed the work */
  roleId: RoleIdEnum,
  /** The task this merge request is associated with */
  taskId: z.string().uuid().nullable().default(null),
  /** The work order this merge request belongs to */
  workOrderId: z.string().uuid().nullable().default(null),
  /** Current status of the merge request */
  status: GitMergeRequestStatusEnum,
  /** Files with merge conflicts (populated on CONFLICT status) */
  conflictFiles: z.array(z.string()).default([]),
  /** Human-readable error or conflict description */
  message: z.string().nullable().default(null),
  /** When the merge request was created */
  createdAt: z.string().datetime(),
  /** When the merge request was resolved (merged, rejected, etc.) */
  resolvedAt: z.string().datetime().nullable().default(null),
});

export type GitMergeRequest = z.infer<typeof GitMergeRequestSchema>;

// ─── API Schemas ────────────────────────────────────────────────────────────

export const CreateGitMergeRequestInput = z.object({
  sessionId: z.string().uuid(),
  targetBranch: z.string().min(1).optional().default("main"),
});

export type CreateGitMergeRequestInputType = z.infer<
  typeof CreateGitMergeRequestInput
>;

export const ExecuteGitMergeRequestInput = z.object({
  /** Squash merge instead of regular merge (default: true) */
  squash: z.boolean().optional().default(true),
});

export type ExecuteGitMergeRequestInputType = z.infer<
  typeof ExecuteGitMergeRequestInput
>;

export const GitMergeRequestResponse = GitMergeRequestSchema;
export type GitMergeRequestResponseType = z.infer<
  typeof GitMergeRequestResponse
>;

export const GitMergeRequestListResponse = z.array(GitMergeRequestSchema);
export type GitMergeRequestListResponseType = z.infer<
  typeof GitMergeRequestListResponse
>;
