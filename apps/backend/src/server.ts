import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
} from "@bot-ville/core";
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
 * Check whether a TCP port is currently in use.
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

/**
 * On Windows, find the PID listening on a given port using netstat and kill it.
 * On Unix, use lsof + kill. Logs what it does; swallows errors gracefully.
 */
async function killProcessOnPort(port: number): Promise<void> {
  const isWindows = process.platform === "win32";

  try {
    if (isWindows) {
      const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "TCP"]);
      const lines = stdout.split("\n");
      for (const line of lines) {
        // Match lines like:  TCP    0.0.0.0:4000   0.0.0.0:0   LISTENING   12345
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== "0") {
            console.log(
              `[startup] Port ${port} is held by stale process (PID ${pid}). Killing it...`
            );
            await execFileAsync("taskkill", ["/PID", pid, "/F"]);
            console.log(`[startup] Killed PID ${pid}.`);
            return;
          }
        }
      }
    } else {
      const { stdout } = await execFileAsync("lsof", [
        "-ti",
        `:${port}`,
        "-sTCP:LISTEN",
      ]);
      const pid = stdout.trim();
      if (pid && /^\d+$/.test(pid)) {
        console.log(
          `[startup] Port ${port} is held by stale process (PID ${pid}). Killing it...`
        );
        await execFileAsync("kill", ["-9", pid]);
        console.log(`[startup] Killed PID ${pid}.`);
      }
    }
  } catch {
    // netstat/lsof/kill may fail if process already exited — that's fine
  }
}

/**
 * Ensure the target port is free before starting the server.
 * If a stale process is holding the port, kill it and wait for release.
 */
async function ensurePortFree(port: number): Promise<void> {
  if (!(await isPortInUse(port))) return;

  console.warn(
    `[startup] Port ${port} is already in use — attempting to reclaim it.`
  );
  await killProcessOnPort(port);

  // Wait up to 5 seconds for the port to become free
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port))) return;
    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(
    `Port ${port} is still in use after attempting cleanup. ` +
      `Manually kill the process using it and try again.`
  );
}

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

/**
 * Prisma SQLite URL is `file:../data/farm.db` (relative to `prisma/`).
 * SQLite cannot create the DB file if `data/` is missing — error 14.
 */
function ensureSqliteDataDir(): void {
  const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  mkdirSync(join(backendRoot, "data"), { recursive: true });
}

async function main() {
  // Reclaim the port if a previous instance didn't shut down cleanly
  await ensurePortFree(PORT);

  ensureSqliteDataDir();

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
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Shutting down (${signal})...`);
    agentSpawner.killAll("Server shutdown");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  // Windows: 'beforeExit' fires when the event loop drains (e.g. parent killed)
  process.on("beforeExit", () => {
    if (!shuttingDown) {
      shuttingDown = true;
      agentSpawner.killAll("Server shutdown");
    }
  });

  // Start server
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Farm backend running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
