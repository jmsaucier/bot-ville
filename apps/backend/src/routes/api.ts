import type { FastifyInstance } from "fastify";
import type { FarmEngine } from "@bot-ville/core";
import type { PrismaAdapter } from "../persistence/prisma-adapter.js";
import {
  CreateWorkOrderRequest,
  AssignTaskRequest,
  SubmitArtifactRequest,
  RequestMergeRequest,
  EventQueryParams,
} from "@bot-ville/shared";

/**
 * Mutating API routes (POST) + mirrored read routes (GET) under /api/*
 * Only the Electron desktop app should call these.
 */
export function registerApiRoutes(
  app: FastifyInstance,
  engine: FarmEngine,
  adapter: PrismaAdapter
): void {
  // ── Mutating Routes ──

  app.post("/api/work-orders", async (request, reply) => {
    const body = CreateWorkOrderRequest.parse(request.body);
    const wo = await engine.createWorkOrder(body.goal, body.context);
    return reply.status(201).send(wo);
  });

  app.post<{ Params: { id: string } }>(
    "/api/work-orders/:id/tick",
    async (_request, reply) => {
      const result = await engine.tick();
      return reply.send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/assign",
    async (request, reply) => {
      const { id } = request.params;
      const body = AssignTaskRequest.parse(request.body);
      const task = await engine.assignTask(id, body.roleId);
      return reply.send(task);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/artifact",
    async (request, reply) => {
      const { id } = request.params;
      const body = SubmitArtifactRequest.parse(request.body);
      const artifact = await engine.submitArtifact(id, body.roleId, {
        type: body.type,
        content: body.content,
        workOrderId: body.workOrderId,
      });
      return reply.status(201).send(artifact);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/work-orders/:id/merge",
    async (request, reply) => {
      const { id } = request.params;
      const body = RequestMergeRequest.parse(request.body);
      const result = await engine.requestMerge(id, body.artifactType);
      return reply.send(result);
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/tasks/:id/status",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as {
        status: string;
        roleId: string;
        reason?: string;
      };
      const task = await engine.updateTaskStatus(
        id,
        body.status as Parameters<typeof engine.updateTaskStatus>[1],
        body.roleId as Parameters<typeof engine.updateTaskStatus>[2],
        body.reason
      );
      return reply.send(task);
    }
  );

  app.post("/api/tasks", async (request, reply) => {
    const body = request.body as {
      workOrderId: string;
      title: string;
      description?: string;
      deps?: string[];
    };
    const task = await engine.createTask(
      body.workOrderId,
      body.title,
      body.description,
      body.deps
    );
    return reply.status(201).send(task);
  });

  // ── Mirrored Read Routes (also available under /api/* for desktop) ──

  app.get("/api/work-orders", async (_request, reply) => {
    const workOrders = await adapter.listWorkOrders();
    return reply.send(workOrders);
  });

  app.get<{ Params: { id: string } }>(
    "/api/work-orders/:id",
    async (request, reply) => {
      const snapshot = await engine.getSnapshot(request.params.id);
      return reply.send(snapshot);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/api/work-orders/:id/tasks",
    async (request, reply) => {
      const tasks = await adapter.listTasks(request.params.id);
      return reply.send(tasks);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/api/work-orders/:id/artifacts",
    async (request, reply) => {
      const artifacts = await adapter.listArtifacts(request.params.id);
      return reply.send(artifacts);
    }
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/api/work-orders/:id/events",
    async (request, reply) => {
      const params = EventQueryParams.parse({
        ...request.query,
        workOrderId: request.params.id,
      });
      const events = await adapter.queryEvents(params);
      return reply.send(events);
    }
  );

  app.get("/api/events", async (request, reply) => {
    const params = EventQueryParams.parse(request.query);
    const events = await adapter.queryEvents(params);
    return reply.send(events);
  });

  app.get("/api/health", async (_request, reply) => {
    const health = engine.getHealth();
    const [activeCount, blockedCount, woCount] = await Promise.all([
      adapter.getActiveTaskCount(),
      adapter.getBlockedTaskCount(),
      adapter.listWorkOrders().then((wos) => wos.length),
    ]);
    return reply.send({
      status: "healthy",
      uptime: health.uptime,
      workOrderCount: woCount,
      activeTaskCount: activeCount,
      blockedTaskCount: blockedCount,
      lastTick: health.lastTick,
    });
  });
}
