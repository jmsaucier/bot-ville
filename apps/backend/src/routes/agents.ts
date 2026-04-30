import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { AgentSpawner, AgentRegistry } from "@bot-ville/core";
import {
  SpawnAgentRequest,
  AgentHeartbeatRequest,
  AgentDoneRequest,
  SendMailRequest,
  type AgentSession,
  type AgentSessionStatus,
  type AgentMail,
  type RoleId,
} from "@bot-ville/shared";

/**
 * Agent management API routes.
 * Handles spawning, monitoring, and communicating with agent CLI instances.
 */
export function registerAgentRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  spawner: AgentSpawner,
  registry: AgentRegistry
): void {
  // ── Spawn ──

  app.post("/api/agents/spawn", async (request, reply) => {
    const body = SpawnAgentRequest.parse(request.body);

    const session = await spawner.spawn({
      agentPresetId: body.agentPresetId,
      roleId: body.roleId,
      workOrderId: body.workOrderId,
      taskId: body.taskId,
      initialPrompt: body.initialPrompt,
      workingDirectory: body.workingDirectory,
      apiUrl: `http://localhost:${process.env["PORT"] ?? 4000}`,
    });

    // Persist to database
    await prisma.agentSession.create({
      data: {
        id: session.id,
        agentPresetId: session.agentPresetId,
        roleId: session.roleId,
        workOrderId: session.workOrderId,
        taskId: session.taskId,
        status: session.status,
        pid: session.pid,
        workingDirectory: session.workingDirectory,
        agentSessionId: session.agentSessionId,
        lastHeartbeat: session.lastHeartbeat
          ? new Date(session.lastHeartbeat)
          : null,
        spawnedAt: new Date(session.spawnedAt),
        completedAt: session.completedAt
          ? new Date(session.completedAt)
          : null,
      },
    });

    return reply.status(201).send(session);
  });

  // ── List ──

  app.get("/api/agents", async (request, reply) => {
    const query = request.query as { status?: string };

    const where: Record<string, unknown> = {};
    if (query.status) {
      where.status = query.status;
    }

    const rows = await prisma.agentSession.findMany({
      where,
      orderBy: { spawnedAt: "desc" },
    });

    const sessions: AgentSession[] = rows.map(toAgentSession);
    return reply.send(sessions);
  });

  // ── Get Session ──

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id",
    async (request, reply) => {
      const { id } = request.params;

      // Try in-memory first, then database
      const inMemory = spawner.getSession(id);
      if (inMemory) {
        return reply.send(inMemory);
      }

      const row = await prisma.agentSession.findUnique({ where: { id } });
      if (!row) {
        return reply.status(404).send({ error: "Agent session not found" });
      }

      return reply.send(toAgentSession(row));
    }
  );

  // ── Heartbeat ──

  app.post<{ Params: { id: string } }>(
    "/api/agents/:id/heartbeat",
    async (request, reply) => {
      const { id } = request.params;
      const body = AgentHeartbeatRequest.parse(request.body);

      // Update in-memory state
      spawner.heartbeat(id, body.message);

      // Persist heartbeat
      await prisma.agentSession.update({
        where: { id },
        data: { lastHeartbeat: new Date() },
      });

      return reply.send({ ok: true });
    }
  );

  // ── Done ──

  app.post<{ Params: { id: string } }>(
    "/api/agents/:id/done",
    async (request, reply) => {
      const { id } = request.params;
      const body = AgentDoneRequest.parse(request.body);

      // Mark as completed in-memory
      spawner.markCompleted(id, body.message);

      // Persist completion
      await prisma.agentSession.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });

      return reply.send({ ok: true, message: body.message });
    }
  );

  // ── Kill ──

  app.delete<{ Params: { id: string } }>(
    "/api/agents/:id",
    async (request, reply) => {
      const { id } = request.params;
      const query = request.query as { reason?: string };

      const killed = spawner.kill(id, query.reason);

      if (killed) {
        await prisma.agentSession.update({
          where: { id },
          data: {
            status: "killed",
            completedAt: new Date(),
          },
        });
      }

      return reply.send({ ok: killed });
    }
  );

  // ── Send Mail ──

  app.post<{ Params: { id: string } }>(
    "/api/agents/:id/mail",
    async (request, reply) => {
      const { id } = request.params;
      const body = SendMailRequest.parse(request.body);

      const mail = await prisma.agentMail.create({
        data: {
          fromId: id,
          toId: body.to,
          subject: body.subject,
          body: body.body,
        },
      });

      return reply.status(201).send(toAgentMail(mail));
    }
  );

  // ── Check Mail ──

  app.get<{ Params: { id: string } }>(
    "/api/agents/:id/mail",
    async (request, reply) => {
      const { id } = request.params;

      const rows = await prisma.agentMail.findMany({
        where: { toId: id },
        orderBy: { sentAt: "desc" },
      });

      const messages: AgentMail[] = rows.map(toAgentMail);
      return reply.send(messages);
    }
  );

  // ── List Presets ──

  app.get("/api/agents/presets", async (_request, reply) => {
    const presets = registry.listPresets();
    return reply.send(presets);
  });
}

// ── Helpers ──

function toAgentSession(row: {
  id: string;
  agentPresetId: string;
  roleId: string;
  workOrderId: string | null;
  taskId: string | null;
  status: string;
  pid: number | null;
  workingDirectory: string | null;
  agentSessionId: string | null;
  lastHeartbeat: Date | null;
  spawnedAt: Date;
  completedAt: Date | null;
}): AgentSession {
  return {
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
  };
}

function toAgentMail(row: {
  id: string;
  fromId: string;
  toId: string;
  subject: string;
  body: string;
  sentAt: Date;
  readAt: Date | null;
}): AgentMail {
  return {
    id: row.id,
    from: row.fromId,
    to: row.toId,
    subject: row.subject,
    body: row.body,
    sentAt: row.sentAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}
