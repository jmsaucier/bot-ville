import { z } from "zod";

export const StatusEnum = z.enum([
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "MERGED",
  "DONE",
  "FAILED",
]);

export type Status = z.infer<typeof StatusEnum>;

/** Valid status transitions map */
export const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  NEW: ["ASSIGNED", "FAILED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "FAILED"],
  IN_PROGRESS: ["BLOCKED", "REVIEW", "DONE", "FAILED"],
  BLOCKED: ["ASSIGNED", "IN_PROGRESS", "FAILED"],
  REVIEW: ["MERGED", "IN_PROGRESS", "BLOCKED", "FAILED"],
  MERGED: ["DONE"],
  DONE: [],
  FAILED: ["NEW"],
};

export function isValidTransition(from: Status, to: Status): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}
