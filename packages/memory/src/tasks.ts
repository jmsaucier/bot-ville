/**
 * TaskManager — create, update, and list tasks with step tracking.
 *
 * Each task is stored as a separate JSON file:
 *   <rootDir>/tasks/<taskId>.json
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJson, writeJson, deleteFile, listJson } from "./store.js";
import type { Task, TaskInput, TaskPatch, TaskStatus } from "./types.js";

export class TaskManager {
  private readonly tasksDir: string;

  constructor(rootDir: string) {
    this.tasksDir = join(rootDir, "tasks");
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------

  /** Create a new task. Steps should include their own IDs. */
  async create(input: TaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      status: input.status ?? "pending",
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await writeJson(this.taskPath(task.id), task);
    return task;
  }

  // -----------------------------------------------------------------------
  // Read
  // -----------------------------------------------------------------------

  /** Get a single task by ID, or `null` if not found. */
  async get(id: string): Promise<Task | null> {
    return readJson<Task>(this.taskPath(id));
  }

  /**
   * List tasks, optionally filtered by status.
   */
  async list(filter?: { status?: TaskStatus }): Promise<Task[]> {
    const items = await listJson<Task>(this.tasksDir);
    let tasks = items.map((i) => i.data);

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }

    // Sort by creation date descending (newest first).
    tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return tasks;
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  /** Patch fields on an existing task. */
  async update(id: string, patch: TaskPatch): Promise<Task | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const updated: Task = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(this.taskPath(id), updated);
    return updated;
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  /** Remove a task. */
  async remove(id: string): Promise<void> {
    await deleteFile(this.taskPath(id));
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private taskPath(id: string): string {
    return join(this.tasksDir, `${id}.json`);
  }
}
