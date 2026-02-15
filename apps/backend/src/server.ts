import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PrismaClient } from "@prisma/client";
import {
  FarmEngine,
  EventBus,
  registerAllRoles,
  AgentRegistry,
  AgentSpawner,
  WorktreeManager,
  GitMergeEngine,
} from "@repo/core";
import { PrismaAdapter } from "./persistence/prisma-adapter.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerWsRoute } from "./routes/ws.js";
import { registerDemoRoute } from "./routes/demo.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerMergeRequestRoutes } from "./routes/merge-requests.js";
import { registerProjectRoutes, type ProjectContext } from "./routes/project.js";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env["PORT"] ?? 4000);
const HOST = process.env["HOST"] ?? "0.0.0.0";

/**
 * Detect the git repo root for the current project context.
 * Returns null if not inside a git repo.
 */
async function detectRepoRoot(projectDir?: string | null): Promise<string | null> {
  try {
    const cwd = projectDir ?? process.cwd();
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function main() {
  // Initialize Prisma
  const prisma = new PrismaClient();
  await prisma.$connect();

  // Initialize core engine
  registerAllRoles();
  const eventBus = new EventBus();
  const adapter = new PrismaAdapter(prisma);
  const engine = new FarmEngine(adapter, eventBus);

  // Detect repo root for worktree support
  const repoRoot = await detectRepoRoot();

  // Initialize agent orchestration with worktree support
  const agentRegistry = new AgentRegistry();
  const worktreeManager = new WorktreeManager();
  const agentSpawner = new AgentSpawner(
    agentRegistry,
    eventBus,
    repoRoot ? worktreeManager : undefined,
    repoRoot ? { repoRoot } : undefined
  );

  // Initialize git merge engine (for merging agent branches back to main)
  const gitMergeEngine = repoRoot ? new GitMergeEngine(repoRoot, eventBus) : null;

  // Initialize project context (in-memory, set by desktop app)
  const projectContext: ProjectContext = {
    projectDirectory: null,
    projectName: null,
  };

  // Create Fastify instance
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Register routes
  registerApiRoutes(app, engine, adapter);
  registerPublicRoutes(app, engine, adapter, prisma);
  registerWsRoute(app, eventBus);
  registerDemoRoute(app, engine);
  registerAgentRoutes(app, prisma, agentSpawner, agentRegistry);
  if (gitMergeEngine) {
    registerMergeRequestRoutes(app, gitMergeEngine, agentSpawner);
  }
  registerProjectRoutes(app, projectContext, eventBus, agentSpawner);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    agentSpawner.killAll("Server shutdown");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start server
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Farm backend running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
