import type {
  WorkOrder,
  Task,
  Artifact,
  Decision,
  EventLog,
  Status,
  RoleId,
} from "@bot-ville/shared";

// ─── Event Filters ───────────────────────────────────────────────────────────

export interface EventFilters {
  workOrderId?: string;
  role?: RoleId;
  action?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

// ─── Persistence Adapter Interface ───────────────────────────────────────────

/**
 * Abstract persistence interface that the backend implements.
 * The core engine is I/O-free; all storage goes through this adapter.
 */
export interface PersistenceAdapter {
  // ── Work Orders ──
  createWorkOrder(wo: WorkOrder): Promise<WorkOrder>;
  getWorkOrder(id: string): Promise<WorkOrder | null>;
  listWorkOrders(): Promise<WorkOrder[]>;
  updateWorkOrder(
    id: string,
    patch: Partial<Pick<WorkOrder, "status" | "updatedAt">>
  ): Promise<WorkOrder>;

  // ── Tasks ──
  createTask(task: Task): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  listTasks(workOrderId: string): Promise<Task[]>;
  listTasksByStatus(status: Status): Promise<Task[]>;
  updateTask(
    id: string,
    patch: Partial<Pick<Task, "status" | "ownerRole" | "description" | "updatedAt">>
  ): Promise<Task>;

  // ── Artifacts ──
  createArtifact(artifact: Artifact): Promise<Artifact>;
  getArtifact(id: string): Promise<Artifact | null>;
  listArtifacts(workOrderId: string): Promise<Artifact[]>;
  listArtifactsByType(
    workOrderId: string,
    type: string
  ): Promise<Artifact[]>;
  updateArtifact(
    id: string,
    patch: Partial<Pick<Artifact, "canonical" | "content" | "version" | "updatedAt">>
  ): Promise<Artifact>;

  // ── Decisions ──
  createDecision(decision: Decision): Promise<Decision>;
  listDecisions(workOrderId: string): Promise<Decision[]>;

  // ── Event Log ──
  createEventLog(event: EventLog): Promise<EventLog>;
  queryEvents(filters: EventFilters): Promise<EventLog[]>;

  // ── Aggregate ──
  getWorkOrderTaskCount(workOrderId: string): Promise<number>;
  getActiveTaskCount(): Promise<number>;
  getBlockedTaskCount(): Promise<number>;
}
