import type { FastifyInstance } from "fastify";
import type { FarmEngine } from "@repo/core";
import type { PrismaAdapter } from "../persistence/prisma-adapter.js";
import { EventQueryParams } from "@repo/shared";

/**
 * Read-only routes under /public/*
 * The web view calls ONLY these endpoints.
 * No POST/PUT/DELETE/PATCH routes are registered here.
 */
export function registerPublicRoutes(
  app: FastifyInstance,
  engine: FarmEngine,
  adapter: PrismaAdapter
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

  app.get<{ Params: { id: string } }>(
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
}
