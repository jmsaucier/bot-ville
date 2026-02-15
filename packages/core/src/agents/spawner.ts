import { spawn, type ChildProcess } from "node:child_process";
import type {
  AgentSession,
  AgentSessionStatus,
  RoleId,
  FarmEvent,
} from "@repo/shared";
import { EventBus } from "../event-bus.js";
import { AgentRegistry } from "./registry.js";

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export interface SpawnOptions {
  /** Agent preset ID (defaults to registry default) */
  agentPresetId?: string;
  /** Farm role this agent will operate as */
  roleId: RoleId;
  /** Work order to assign */
  workOrderId?: string;
  /** Specific task to assign */
  taskId?: string;
  /** Initial prompt to send */
  initialPrompt?: string;
  /** Working directory (defaults to cwd) */
  workingDirectory?: string;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** URL of the bot-ville backend API */
  apiUrl?: string;
}

interface TrackedProcess {
  session: AgentSession;
  process: ChildProcess | null;
}

/**
 * Manages the lifecycle of agent CLI processes.
 * Spawns agents, tracks PIDs, monitors health, and emits events.
 */
export class AgentSpawner {
  private sessions = new Map<string, TrackedProcess>();
  private _defaultWorkingDirectory: string | undefined;

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus
  ) {}

  /** Set the default working directory for new agent sessions. */
  setDefaultWorkingDirectory(dir: string): void {
    this._defaultWorkingDirectory = dir;
  }

  /** Get the current default working directory, if set. */
  getDefaultWorkingDirectory(): string | undefined {
    return this._defaultWorkingDirectory;
  }

  /**
   * Spawn a new agent process.
   * 1. Resolves the agent preset
   * 2. Creates a session record
   * 3. Spawns the CLI process with env vars
   * 4. Emits agent.spawned event
   * 5. Monitors for exit
   */
  async spawn(options: SpawnOptions): Promise<AgentSession> {
    const presetId = options.agentPresetId ?? this.registry.getDefaultPresetId();
    const preset = this.registry.getPresetOrThrow(presetId);

    const sessionId = uuid();
    const cwd = options.workingDirectory ?? this._defaultWorkingDirectory ?? process.cwd();
    const apiUrl = options.apiUrl ?? "http://localhost:4000";

    const session: AgentSession = {
      id: sessionId,
      agentPresetId: presetId,
      roleId: options.roleId,
      workOrderId: options.workOrderId ?? null,
      taskId: options.taskId ?? null,
      status: "spawning",
      pid: null,
      workingDirectory: cwd,
      agentSessionId: null,
      lastHeartbeat: null,
      spawnedAt: now(),
      completedAt: null,
    };

    // Build environment variables for the agent process
    const agentEnv: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...preset.env,
      ...options.env,
      BV_API_URL: apiUrl,
      BV_SESSION_ID: sessionId,
      BV_ROLE: options.roleId,
      BV_AGENT_PRESET: presetId,
    };

    if (options.workOrderId) {
      agentEnv.BV_WORK_ORDER_ID = options.workOrderId;
    }
    if (options.taskId) {
      agentEnv.BV_TASK_ID = options.taskId;
    }

    // Build the command
    const args = [...preset.args];
    if (options.initialPrompt && preset.promptMode !== "none") {
      if (preset.nonInteractive?.promptFlag) {
        args.push(preset.nonInteractive.promptFlag, options.initialPrompt);
      } else {
        args.push(options.initialPrompt);
      }
    }

    // Spawn the process
    let child: ChildProcess;
    try {
      child = spawn(preset.command, args, {
        cwd,
        env: agentEnv,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        detached: false,
      });
    } catch (err) {
      session.status = "failed";
      session.completedAt = now();
      this.sessions.set(sessionId, { session, process: null });

      this.emitEvent({
        type: "agent.failed",
        payload: {
          sessionId,
          agentPresetId: presetId,
          roleId: options.roleId,
          error: err instanceof Error ? err.message : String(err),
          exitCode: null,
        },
      });

      return session;
    }

    session.pid = child.pid ?? null;
    session.status = "running";

    this.sessions.set(sessionId, { session, process: child });

    // Emit spawned event
    this.emitEvent({
      type: "agent.spawned",
      payload: {
        sessionId,
        agentPresetId: presetId,
        roleId: options.roleId,
        workOrderId: options.workOrderId ?? null,
        taskId: options.taskId ?? null,
        pid: session.pid,
      },
    });

    // Monitor process exit
    child.on("exit", (code, signal) => {
      const tracked = this.sessions.get(sessionId);
      if (!tracked) return;

      tracked.process = null;
      tracked.session.completedAt = now();

      if (tracked.session.status === "killed") {
        // Already marked as killed
        return;
      }

      if (code === 0 || tracked.session.status === "completed") {
        tracked.session.status = "completed";
        this.emitEvent({
          type: "agent.completed",
          payload: {
            sessionId,
            agentPresetId: presetId,
            roleId: options.roleId,
          },
        });
      } else {
        tracked.session.status = "failed";
        this.emitEvent({
          type: "agent.failed",
          payload: {
            sessionId,
            agentPresetId: presetId,
            roleId: options.roleId,
            error: signal
              ? `Process killed with signal ${signal}`
              : `Process exited with code ${code}`,
            exitCode: code,
          },
        });
      }
    });

    child.on("error", (err) => {
      const tracked = this.sessions.get(sessionId);
      if (!tracked) return;

      tracked.session.status = "failed";
      tracked.session.completedAt = now();
      tracked.process = null;

      this.emitEvent({
        type: "agent.failed",
        payload: {
          sessionId,
          agentPresetId: presetId,
          roleId: options.roleId,
          error: err.message,
          exitCode: null,
        },
      });
    });

    return session;
  }

  /** Kill an agent process by session ID. */
  kill(sessionId: string, reason?: string): boolean {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) return false;

    tracked.session.status = "killed";
    tracked.session.completedAt = now();

    if (tracked.process && !tracked.process.killed) {
      tracked.process.kill("SIGTERM");

      // Force kill after 5 seconds if still alive
      const forceKillTimeout = setTimeout(() => {
        if (tracked.process && !tracked.process.killed) {
          tracked.process.kill("SIGKILL");
        }
      }, 5000);

      tracked.process.once("exit", () => {
        clearTimeout(forceKillTimeout);
      });
    }

    this.emitEvent({
      type: "agent.killed",
      payload: {
        sessionId,
        agentPresetId: tracked.session.agentPresetId,
        roleId: tracked.session.roleId,
        reason,
      },
    });

    return true;
  }

  /** Record a heartbeat for an agent session. */
  heartbeat(sessionId: string, message?: string): boolean {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) return false;

    tracked.session.lastHeartbeat = now();

    this.emitEvent({
      type: "agent.heartbeat",
      payload: { sessionId, message },
    });

    return true;
  }

  /** Mark an agent session as completed (called by the agent via bv done). */
  markCompleted(sessionId: string, message?: string): boolean {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) return false;

    tracked.session.status = "completed";
    tracked.session.completedAt = now();

    this.emitEvent({
      type: "agent.completed",
      payload: {
        sessionId,
        agentPresetId: tracked.session.agentPresetId,
        roleId: tracked.session.roleId,
        message,
      },
    });

    return true;
  }

  /** Update the status of an agent session. */
  updateStatus(sessionId: string, status: AgentSessionStatus): boolean {
    const tracked = this.sessions.get(sessionId);
    if (!tracked) return false;

    tracked.session.status = status;
    if (status === "completed" || status === "failed" || status === "killed") {
      tracked.session.completedAt = now();
    }

    return true;
  }

  /** Get a session by ID. */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId)?.session;
  }

  /** List all sessions, optionally filtered by status. */
  listSessions(statusFilter?: AgentSessionStatus): AgentSession[] {
    const all = Array.from(this.sessions.values()).map((t) => t.session);
    if (statusFilter) {
      return all.filter((s) => s.status === statusFilter);
    }
    return all;
  }

  /** List only active (spawning or running) sessions. */
  listActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values())
      .filter((t) => t.session.status === "spawning" || t.session.status === "running")
      .map((t) => t.session);
  }

  /** Kill all active sessions. Useful for cleanup on shutdown. */
  killAll(reason?: string): void {
    for (const [sessionId, tracked] of this.sessions) {
      if (tracked.session.status === "running" || tracked.session.status === "spawning") {
        this.kill(sessionId, reason ?? "System shutdown");
      }
    }
  }

  /** Remove completed/failed/killed sessions from in-memory tracking. */
  prune(): number {
    let pruned = 0;
    for (const [sessionId, tracked] of this.sessions) {
      if (
        tracked.session.status === "completed" ||
        tracked.session.status === "failed" ||
        tracked.session.status === "killed"
      ) {
        this.sessions.delete(sessionId);
        pruned++;
      }
    }
    return pruned;
  }

  private emitEvent(event: FarmEvent): void {
    this.eventBus.emit(event);
  }
}
