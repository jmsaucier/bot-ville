import type {
  WorkOrder,
  Task,
  Artifact,
  Decision,
  EventLog,
  RoleId,
  Status,
  WorkOrderSnapshot,
  ArtifactDraftInputType,
  FarmEvent,
} from "@repo/shared";
import { isValidTransition } from "@repo/shared";
import { EventBus } from "./event-bus.js";
import type { PersistenceAdapter } from "./persistence.js";
import { enforcePolicy } from "./policy-engine.js";
import { MergeEngine, type MergeResult } from "./merge/merge-engine.js";

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export interface TickResult {
  tickNumber: number;
  bellRinger: { triggered: boolean };
  scout: { triaged: number; unblocked: number };
  dogs: { maintenanceActions: number };
  heel: { alerts: number };
}

/**
 * The core farm orchestration engine.
 * Pure logic -- all I/O goes through the PersistenceAdapter.
 */
export class FarmEngine {
  private tickCount = 0;
  private startTime = Date.now();
  private lastTickTime: string | null = null;
  private mergeEngine: MergeEngine;

  constructor(
    private readonly persistence: PersistenceAdapter,
    private readonly eventBus: EventBus
  ) {
    this.mergeEngine = new MergeEngine(persistence, eventBus);
  }

  // ── Helpers ──

  private async emitAndPersist(
    event: FarmEvent,
    role: RoleId | null = null,
    workOrderId: string | null = null,
    correlationId: string | null = null
  ): Promise<void> {
    const logEntry: EventLog = {
      id: uuid(),
      timestamp: now(),
      role,
      action: event.type,
      payload: event.payload as Record<string, unknown>,
      correlationId,
      workOrderId,
    };
    await this.persistence.createEventLog(logEntry);
    this.eventBus.emit(event);
  }

  // ── Public API ──

  async createWorkOrder(
    goalText: string,
    context?: Record<string, unknown>
  ): Promise<WorkOrder> {
    const wo: WorkOrder = {
      id: uuid(),
      goal: goalText,
      context: context ?? {},
      status: "NEW",
      createdAt: now(),
      updatedAt: now(),
    };

    const created = await this.persistence.createWorkOrder(wo);

    await this.emitAndPersist(
      {
        type: "workorder.created",
        payload: { workOrderId: created.id, goal: goalText },
      },
      "FARM_MANAGER",
      created.id
    );

    return created;
  }

  async createTask(
    workOrderId: string,
    title: string,
    description = "",
    deps: string[] = []
  ): Promise<Task> {
    const task: Task = {
      id: uuid(),
      workOrderId,
      title,
      description,
      status: "NEW",
      ownerRole: null,
      deps,
      createdAt: now(),
      updatedAt: now(),
    };

    const created = await this.persistence.createTask(task);

    await this.emitAndPersist(
      {
        type: "task.created",
        payload: { taskId: created.id, workOrderId, title },
      },
      "FARM_MANAGER",
      workOrderId
    );

    return created;
  }

  async assignTask(taskId: string, roleId: RoleId): Promise<Task> {
    enforcePolicy("assign_task", "FARM_MANAGER");

    const task = await this.persistence.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const updated = await this.persistence.updateTask(taskId, {
      ownerRole: roleId,
      status: "ASSIGNED",
      updatedAt: now(),
    });

    await this.emitAndPersist(
      { type: "task.assigned", payload: { taskId, roleId } },
      "FARM_MANAGER",
      task.workOrderId
    );

    if (task.status !== "ASSIGNED") {
      await this.emitAndPersist(
        {
          type: "task.status_changed",
          payload: {
            taskId,
            fromStatus: task.status,
            toStatus: "ASSIGNED",
          },
        },
        "FARM_MANAGER",
        task.workOrderId
      );
    }

    return updated;
  }

  async updateTaskStatus(
    taskId: string,
    newStatus: Status,
    roleId: RoleId,
    reason?: string
  ): Promise<Task> {
    const task = await this.persistence.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (!isValidTransition(task.status, newStatus)) {
      throw new Error(
        `Invalid status transition: ${task.status} -> ${newStatus}`
      );
    }

    // Enforce completion policy
    if (newStatus === "DONE") {
      enforcePolicy("complete_task", roleId);
    }

    const updated = await this.persistence.updateTask(taskId, {
      status: newStatus,
      updatedAt: now(),
    });

    await this.emitAndPersist(
      {
        type: "task.status_changed",
        payload: {
          taskId,
          fromStatus: task.status,
          toStatus: newStatus,
          reason,
        },
      },
      roleId,
      task.workOrderId
    );

    return updated;
  }

  async submitArtifact(
    taskId: string,
    roleId: RoleId,
    draft: ArtifactDraftInputType
  ): Promise<Artifact> {
    enforcePolicy("submit_artifact", roleId);

    const task = await this.persistence.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const artifact: Artifact = {
      id: uuid(),
      type: draft.type,
      content: draft.content,
      createdByRole: roleId,
      linkedTaskId: taskId,
      workOrderId: draft.workOrderId,
      version: 1,
      canonical: false,
      createdAt: now(),
      updatedAt: now(),
    };

    const created = await this.persistence.createArtifact(artifact);

    await this.emitAndPersist(
      {
        type: "artifact.submitted",
        payload: {
          artifactId: created.id,
          taskId,
          type: draft.type,
          roleId,
        },
      },
      roleId,
      draft.workOrderId
    );

    return created;
  }

  async requestMerge(
    workOrderId: string,
    artifactType: string
  ): Promise<MergeResult> {
    enforcePolicy("request_merge", "FARM_MANAGER");

    return this.mergeEngine.merge(workOrderId, artifactType);
  }

  async recordDecision(
    workOrderId: string,
    roleId: RoleId,
    summary: string,
    rationale: string,
    linkedTaskId: string | null = null
  ): Promise<Decision> {
    const decision: Decision = {
      id: uuid(),
      summary,
      rationale,
      role: roleId,
      linkedTaskId,
      workOrderId,
      createdAt: now(),
    };

    const created = await this.persistence.createDecision(decision);

    await this.emitAndPersist(
      {
        type: "decision.recorded",
        payload: {
          decisionId: created.id,
          summary,
          linkedTaskId,
        },
      },
      roleId,
      workOrderId
    );

    return created;
  }

  async tick(): Promise<TickResult> {
    this.tickCount++;
    this.lastTickTime = now();

    const result: TickResult = {
      tickNumber: this.tickCount,
      bellRinger: { triggered: true },
      scout: { triaged: 0, unblocked: 0 },
      dogs: { maintenanceActions: 0 },
      heel: { alerts: 0 },
    };

    // Bell Ringer: emit cadence tick
    await this.emitAndPersist(
      {
        type: "cadence.tick",
        payload: {
          tickNumber: this.tickCount,
          timestamp: this.lastTickTime,
        },
      },
      "BELL_RINGER"
    );

    // Scout: find blocked tasks and try to triage
    const blockedTasks = await this.persistence.listTasksByStatus("BLOCKED");
    for (const task of blockedTasks) {
      result.scout.triaged++;

      // Check if blocking dependencies are resolved
      const canUnblock = await this.checkDepsResolved(task);
      if (canUnblock) {
        await this.persistence.updateTask(task.id, {
          status: "ASSIGNED",
          updatedAt: now(),
        });

        await this.emitAndPersist(
          {
            type: "scout.triage",
            payload: {
              taskId: task.id,
              action: "unblock",
              resolution: "Dependencies resolved, task unblocked",
            },
          },
          "FIELD_SCOUT",
          task.workOrderId
        );

        await this.emitAndPersist(
          {
            type: "task.status_changed",
            payload: {
              taskId: task.id,
              fromStatus: "BLOCKED",
              toStatus: "ASSIGNED",
              reason: "Scout: dependencies resolved",
            },
          },
          "FIELD_SCOUT",
          task.workOrderId
        );

        result.scout.unblocked++;
      }
    }

    // Barn Dogs: basic maintenance check
    await this.emitAndPersist(
      {
        type: "dogs.maintenance",
        payload: {
          action: "routine_check",
          details: `Tick ${this.tickCount}: routine maintenance check`,
        },
      },
      "BARN_DOG"
    );
    result.dogs.maintenanceActions++;

    // Heel: watchdog check for stuck tasks
    const inProgressTasks =
      await this.persistence.listTasksByStatus("IN_PROGRESS");
    const staleThreshold = 1000 * 60 * 30; // 30 minutes
    for (const task of inProgressTasks) {
      const taskAge = Date.now() - new Date(task.updatedAt).getTime();
      if (taskAge > staleThreshold) {
        await this.emitAndPersist(
          {
            type: "heel.watchdog_alert",
            payload: {
              alertType: "stale_task",
              severity: "medium",
              message: `Task "${task.title}" has been in progress for over 30 minutes`,
              affectedEntities: [task.id],
            },
          },
          "HEEL",
          task.workOrderId
        );
        result.heel.alerts++;
      }
    }

    return result;
  }

  async getSnapshot(workOrderId: string): Promise<WorkOrderSnapshot> {
    const workOrder = await this.persistence.getWorkOrder(workOrderId);
    if (!workOrder) throw new Error(`WorkOrder ${workOrderId} not found`);

    const [tasks, artifacts, decisions, events] = await Promise.all([
      this.persistence.listTasks(workOrderId),
      this.persistence.listArtifacts(workOrderId),
      this.persistence.listDecisions(workOrderId),
      this.persistence.queryEvents({ workOrderId, limit: 1000 }),
    ]);

    return { workOrder, tasks, artifacts, decisions, events };
  }

  getHealth() {
    return {
      uptime: Date.now() - this.startTime,
      lastTick: this.lastTickTime,
      tickCount: this.tickCount,
    };
  }

  // ── Private helpers ──

  private async checkDepsResolved(task: Task): Promise<boolean> {
    if (task.deps.length === 0) return true;

    for (const depId of task.deps) {
      const dep = await this.persistence.getTask(depId);
      if (!dep || (dep.status !== "DONE" && dep.status !== "MERGED")) {
        return false;
      }
    }
    return true;
  }
}
