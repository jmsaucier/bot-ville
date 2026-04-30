import { PrismaClient } from "@prisma/client";
import type { PersistenceAdapter, EventFilters } from "@repo/core";
import type {
  WorkOrder,
  Task,
  Artifact,
  Decision,
  EventLog,
  Status,
  RoleId,
} from "@repo/shared";

/**
 * Implements PersistenceAdapter using Prisma + SQLite.
 * Handles JSON serialization for fields stored as strings in SQLite.
 */
export class PrismaAdapter implements PersistenceAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Helpers for SQLite JSON fields ──

  private toWorkOrder(row: {
    id: string;
    goal: string;
    context: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): WorkOrder {
    return {
      id: row.id,
      goal: row.goal,
      context: JSON.parse(row.context) as Record<string, unknown>,
      status: row.status as Status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toTask(row: {
    id: string;
    workOrderId: string;
    title: string;
    description: string;
    status: string;
    ownerRole: string | null;
    deps: string;
    createdAt: Date;
    updatedAt: Date;
  }): Task {
    return {
      id: row.id,
      workOrderId: row.workOrderId,
      title: row.title,
      description: row.description,
      status: row.status as Status,
      ownerRole: (row.ownerRole as RoleId) ?? null,
      deps: JSON.parse(row.deps) as string[],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toArtifact(row: {
    id: string;
    type: string;
    content: string;
    createdByRole: string;
    linkedTaskId: string | null;
    workOrderId: string;
    version: number;
    canonical: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Artifact {
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      createdByRole: row.createdByRole as RoleId,
      linkedTaskId: row.linkedTaskId,
      workOrderId: row.workOrderId,
      version: row.version,
      canonical: row.canonical,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDecision(row: {
    id: string;
    summary: string;
    rationale: string;
    role: string;
    linkedTaskId: string | null;
    workOrderId: string;
    createdAt: Date;
  }): Decision {
    return {
      id: row.id,
      summary: row.summary,
      rationale: row.rationale,
      role: row.role as RoleId,
      linkedTaskId: row.linkedTaskId,
      workOrderId: row.workOrderId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toEventLog(row: {
    id: string;
    timestamp: Date;
    role: string | null;
    action: string;
    payload: string;
    correlationId: string | null;
    workOrderId: string | null;
  }): EventLog {
    return {
      id: row.id,
      timestamp: row.timestamp.toISOString(),
      role: (row.role as RoleId) ?? null,
      action: row.action,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      correlationId: row.correlationId,
      workOrderId: row.workOrderId,
    };
  }

  // ── Work Orders ──

  async createWorkOrder(wo: WorkOrder): Promise<WorkOrder> {
    const row = await this.prisma.workOrder.create({
      data: {
        id: wo.id,
        goal: wo.goal,
        context: JSON.stringify(wo.context),
        status: wo.status,
      },
    });
    return this.toWorkOrder(row);
  }

  async getWorkOrder(id: string): Promise<WorkOrder | null> {
    const row = await this.prisma.workOrder.findUnique({ where: { id } });
    return row ? this.toWorkOrder(row) : null;
  }

  async listWorkOrders(): Promise<WorkOrder[]> {
    const rows = await this.prisma.workOrder.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toWorkOrder(r));
  }

  async updateWorkOrder(
    id: string,
    patch: Partial<Pick<WorkOrder, "status" | "updatedAt">>
  ): Promise<WorkOrder> {
    const row = await this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    });
    return this.toWorkOrder(row);
  }

  // ── Tasks ──

  async createTask(task: Task): Promise<Task> {
    const row = await this.prisma.task.create({
      data: {
        id: task.id,
        workOrderId: task.workOrderId,
        title: task.title,
        description: task.description,
        status: task.status,
        ownerRole: task.ownerRole,
        deps: JSON.stringify(task.deps),
      },
    });
    return this.toTask(row);
  }

  async getTask(id: string): Promise<Task | null> {
    const row = await this.prisma.task.findUnique({ where: { id } });
    return row ? this.toTask(row) : null;
  }

  async listTasks(workOrderId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { workOrderId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toTask(r));
  }

  async listTasksByStatus(status: Status): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { status },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((r) => this.toTask(r));
  }

  async updateTask(
    id: string,
    patch: Partial<
      Pick<Task, "status" | "ownerRole" | "description" | "updatedAt">
    >
  ): Promise<Task> {
    const row = await this.prisma.task.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.ownerRole !== undefined
          ? { ownerRole: patch.ownerRole }
          : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
      },
    });
    return this.toTask(row);
  }

  // ── Artifacts ──

  async createArtifact(artifact: Artifact): Promise<Artifact> {
    const row = await this.prisma.artifact.create({
      data: {
        id: artifact.id,
        type: artifact.type,
        content: artifact.content,
        createdByRole: artifact.createdByRole,
        linkedTaskId: artifact.linkedTaskId,
        workOrderId: artifact.workOrderId,
        version: artifact.version,
        canonical: artifact.canonical,
      },
    });
    return this.toArtifact(row);
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    const row = await this.prisma.artifact.findUnique({ where: { id } });
    return row ? this.toArtifact(row) : null;
  }

  async listArtifacts(workOrderId: string): Promise<Artifact[]> {
    const rows = await this.prisma.artifact.findMany({
      where: { workOrderId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toArtifact(r));
  }

  async listArtifactsByType(
    workOrderId: string,
    type: string
  ): Promise<Artifact[]> {
    const rows = await this.prisma.artifact.findMany({
      where: { workOrderId, type },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toArtifact(r));
  }

  async updateArtifact(
    id: string,
    patch: Partial<
      Pick<Artifact, "canonical" | "content" | "version" | "updatedAt">
    >
  ): Promise<Artifact> {
    const row = await this.prisma.artifact.update({
      where: { id },
      data: {
        ...(patch.canonical !== undefined
          ? { canonical: patch.canonical }
          : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.version !== undefined ? { version: patch.version } : {}),
      },
    });
    return this.toArtifact(row);
  }

  // ── Decisions ──

  async createDecision(decision: Decision): Promise<Decision> {
    const row = await this.prisma.decision.create({
      data: {
        id: decision.id,
        summary: decision.summary,
        rationale: decision.rationale,
        role: decision.role,
        linkedTaskId: decision.linkedTaskId,
        workOrderId: decision.workOrderId,
      },
    });
    return this.toDecision(row);
  }

  async listDecisions(workOrderId: string): Promise<Decision[]> {
    const rows = await this.prisma.decision.findMany({
      where: { workOrderId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDecision(r));
  }

  // ── Event Log ──

  async createEventLog(event: EventLog): Promise<EventLog> {
    const row = await this.prisma.eventLog.create({
      data: {
        id: event.id,
        timestamp: new Date(event.timestamp),
        role: event.role,
        action: event.action,
        payload: JSON.stringify(event.payload),
        correlationId: event.correlationId,
        workOrderId: event.workOrderId,
      },
    });
    return this.toEventLog(row);
  }

  async queryEvents(filters: EventFilters): Promise<EventLog[]> {
    const where: Record<string, unknown> = {};

    if (filters.workOrderId) where["workOrderId"] = filters.workOrderId;
    if (filters.role) where["role"] = filters.role;
    if (filters.action) where["action"] = filters.action;
    if (filters.since) where["timestamp"] = { gte: new Date(filters.since) };

    const rows = await this.prisma.eventLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    });

    return rows.map((r) => this.toEventLog(r));
  }

  // ── Aggregates ──

  async getWorkOrderTaskCount(workOrderId: string): Promise<number> {
    return this.prisma.task.count({ where: { workOrderId } });
  }

  async getActiveTaskCount(): Promise<number> {
    return this.prisma.task.count({
      where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    });
  }

  async getBlockedTaskCount(): Promise<number> {
    return this.prisma.task.count({ where: { status: "BLOCKED" } });
  }
}
