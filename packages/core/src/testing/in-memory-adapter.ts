import type {
  WorkOrder,
  Task,
  Artifact,
  Decision,
  EventLog,
  Status,
} from "@bot-ville/shared";
import type { PersistenceAdapter, EventFilters } from "../persistence.js";

/**
 * In-memory persistence adapter for testing.
 * No I/O, no database -- everything stored in Maps.
 */
export class InMemoryAdapter implements PersistenceAdapter {
  private workOrders = new Map<string, WorkOrder>();
  private tasks = new Map<string, Task>();
  private artifacts = new Map<string, Artifact>();
  private decisions = new Map<string, Decision>();
  private eventLogs: EventLog[] = [];

  // ── Work Orders ──

  async createWorkOrder(wo: WorkOrder): Promise<WorkOrder> {
    this.workOrders.set(wo.id, { ...wo });
    return { ...wo };
  }

  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    const wo = this.workOrders.get(id);
    return wo ? { ...wo } : null;
  }

  async listWorkOrders(): Promise<WorkOrder[]> {
    return [...this.workOrders.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateWorkOrder(
    id: string,
    patch: Partial<Pick<WorkOrder, "status" | "updatedAt">>
  ): Promise<WorkOrder> {
    const wo = this.workOrders.get(id);
    if (!wo) throw new Error(`WorkOrder ${id} not found`);
    const updated = {
      ...wo,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.workOrders.set(id, updated);
    return { ...updated };
  }

  // ── Tasks ──

  async createTask(task: Task): Promise<Task> {
    this.tasks.set(task.id, { ...task });
    return { ...task };
  }

  async getTask(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async listTasks(workOrderId: string): Promise<Task[]> {
    return [...this.tasks.values()]
      .filter((t) => t.workOrderId === workOrderId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  async listTasksByStatus(status: Status): Promise<Task[]> {
    return [...this.tasks.values()]
      .filter((t) => t.status === status)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }

  async updateTask(
    id: string,
    patch: Partial<
      Pick<Task, "status" | "ownerRole" | "description" | "updatedAt">
    >
  ): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);
    const updated = {
      ...task,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return { ...updated };
  }

  // ── Artifacts ──

  async createArtifact(artifact: Artifact): Promise<Artifact> {
    this.artifacts.set(artifact.id, { ...artifact });
    return { ...artifact };
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    const a = this.artifacts.get(id);
    return a ? { ...a } : null;
  }

  async listArtifacts(workOrderId: string): Promise<Artifact[]> {
    return [...this.artifacts.values()]
      .filter((a) => a.workOrderId === workOrderId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async listArtifactsByType(
    workOrderId: string,
    type: string
  ): Promise<Artifact[]> {
    return [...this.artifacts.values()]
      .filter((a) => a.workOrderId === workOrderId && a.type === type)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  async updateArtifact(
    id: string,
    patch: Partial<
      Pick<Artifact, "canonical" | "content" | "version" | "updatedAt">
    >
  ): Promise<Artifact> {
    const a = this.artifacts.get(id);
    if (!a) throw new Error(`Artifact ${id} not found`);
    const updated = {
      ...a,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.artifacts.set(id, updated);
    return { ...updated };
  }

  // ── Decisions ──

  async createDecision(decision: Decision): Promise<Decision> {
    this.decisions.set(decision.id, { ...decision });
    return { ...decision };
  }

  async listDecisions(workOrderId: string): Promise<Decision[]> {
    return [...this.decisions.values()]
      .filter((d) => d.workOrderId === workOrderId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  // ── Event Log ──

  async createEventLog(event: EventLog): Promise<EventLog> {
    this.eventLogs.push({ ...event });
    return { ...event };
  }

  async queryEvents(filters: EventFilters): Promise<EventLog[]> {
    let results = [...this.eventLogs];

    if (filters.workOrderId) {
      results = results.filter((e) => e.workOrderId === filters.workOrderId);
    }
    if (filters.role) {
      results = results.filter((e) => e.role === filters.role);
    }
    if (filters.action) {
      results = results.filter((e) => e.action === filters.action);
    }
    if (filters.since) {
      const since = new Date(filters.since).getTime();
      results = results.filter(
        (e) => new Date(e.timestamp).getTime() >= since
      );
    }

    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  // ── Aggregates ──

  async getWorkOrderTaskCount(workOrderId: string): Promise<number> {
    return [...this.tasks.values()].filter(
      (t) => t.workOrderId === workOrderId
    ).length;
  }

  async getActiveTaskCount(): Promise<number> {
    return [...this.tasks.values()].filter(
      (t) => t.status === "ASSIGNED" || t.status === "IN_PROGRESS"
    ).length;
  }

  async getBlockedTaskCount(): Promise<number> {
    return [...this.tasks.values()].filter((t) => t.status === "BLOCKED")
      .length;
  }
}
