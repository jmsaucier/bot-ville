import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { EventBus, AgentSpawner } from "@repo/core";

// ─── Project Context ────────────────────────────────────────────────────────

export interface ProjectContext {
  projectDirectory: string | null;
  projectName: string | null;
}

/**
 * Project management routes.
 * Allows the desktop app to set the active project directory
 * and exposes it read-only for the web dashboard.
 */
export function registerProjectRoutes(
  app: FastifyInstance,
  projectContext: ProjectContext,
  eventBus: EventBus,
  agentSpawner: AgentSpawner
): void {
  // ── Set project (desktop only) ──

  app.post("/api/project", async (request, reply) => {
    const body = request.body as { projectDirectory?: string };
    const projectDirectory = body.projectDirectory;

    if (!projectDirectory || typeof projectDirectory !== "string") {
      return reply
        .status(400)
        .send({ error: "projectDirectory is required and must be a string" });
    }

    const projectName = path.basename(projectDirectory);
    projectContext.projectDirectory = projectDirectory;
    projectContext.projectName = projectName;

    // Update the default working directory for new agent sessions
    agentSpawner.setDefaultWorkingDirectory(projectDirectory);

    // Broadcast project change event
    eventBus.emit({
      type: "project.changed",
      payload: {
        projectDirectory,
        projectName,
      },
    });

    return reply.send({
      projectDirectory,
      projectName,
    });
  });

  // ── Get project (desktop) ──

  app.get("/api/project", async (_request, reply) => {
    return reply.send({
      projectDirectory: projectContext.projectDirectory,
      projectName: projectContext.projectName,
    });
  });

  // ── Get project (web dashboard, read-only) ──

  app.get("/public/project", async (_request, reply) => {
    return reply.send({
      projectDirectory: projectContext.projectDirectory,
      projectName: projectContext.projectName,
    });
  });
}
