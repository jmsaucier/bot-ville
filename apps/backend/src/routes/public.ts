import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { FarmEngine } from "@repo/core";
import type { PrismaAdapter } from "../persistence/prisma-adapter.js";
import { EventQueryParams } from "@repo/shared";
import type { AgentSession, AgentSessionStatus, RoleId } from "@repo/shared";

/**
 * Read-only routes under /public/*
 * The web view calls ONLY these endpoints.
 * No POST/PUT/DELETE/PATCH routes are registered here.
 */
export function registerPublicRoutes(
  app: FastifyInstance,
  engine: FarmEngine,
  adapter: PrismaAdapter,
  prisma?: PrismaClient
): void {
  // Block any non-GET methods on /public/*
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.url.startsWith("/public/") &&
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.method !== "OPTIONS"
    ) {
      return reply.status(405).send({
        error: "Method Not Allowed",
        message: "The /public/* endpoints are read-only. Only GET requests are permitted.",
      });
    }
  });

  app.get("/public/work-orders", async (_request, reply) => {
    const workOrders = await adapter.listWorkOrders();
    return reply.send(workOrders);
  });

  app.get<{ Params: { id: string } }>(
    "/public/work-orders/:id",
    async (request, reply) => {
      const snapshot = await engine.getSnapshot(request.params.id);
      return reply.send(snapshot);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/public/work-orders/:id/tasks",
    async (request, reply) => {
      const tasks = await adapter.listTasks(request.params.id);
      return reply.send(tasks);
    }
  );

  app.get<{ Params: { id: string } }>(
    "/public/work-orders/:id/artifacts",
    async (request, reply) => {
      const artifacts = await adapter.listArtifacts(request.params.id);
      return reply.send(artifacts);
    }
  );

  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>(
    "/public/work-orders/:id/events",
    async (request, reply) => {
      const params = EventQueryParams.parse({
        ...request.query,
        workOrderId: request.params.id,
      });
      const events = await adapter.queryEvents(params);
      return reply.send(events);
    }
  );

  app.get("/public/events", async (request, reply) => {
    const params = EventQueryParams.parse(request.query);
    const events = await adapter.queryEvents(params);
    return reply.send(events);
  });

  app.get("/public/health", async (_request, reply) => {
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

  // ── Agent Sessions (read-only) ──

  if (prisma) {
    app.get("/public/agents", async (request, reply) => {
      const query = request.query as { status?: string };
      const where: Record<string, unknown> = {};
      if (query.status) where.status = query.status;

      const rows = await prisma.agentSession.findMany({
        where,
        orderBy: { spawnedAt: "desc" },
      });

      const sessions: AgentSession[] = rows.map((row) => ({
        id: row.id,
        agentPresetId: row.agentPresetId,
        roleId: row.roleId as RoleId,
        workOrderId: row.workOrderId,
        taskId: row.taskId,
        status: row.status as AgentSessionStatus,
        pid: row.pid,
        workingDirectory: row.workingDirectory,
        agentSessionId: row.agentSessionId,
        lastHeartbeat: row.lastHeartbeat?.toISOString() ?? null,
        spawnedAt: row.spawnedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      }));

      return reply.send(sessions);
    });
  }
}
