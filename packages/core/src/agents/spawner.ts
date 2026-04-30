import { spawn, type ChildProcess } from "node:child_process";
import type {
  AgentSession,
  AgentSessionStatus,
  RoleId,
  FarmEvent,
} from "@bot-ville/shared";
import { EventBus } from "../event-bus.js";
import { AgentRegistry } from "./registry.js";
import { WorktreeManager } from "./worktree.js";

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
  /**
   * Whether to create an isolated git worktree for this agent.
   * When true (and repoRoot is configured), the agent will run in its own
   * worktree on a dedicated branch. Defaults to true when a taskId is provided.
   */
  useWorktree?: boolean;
}

/** Configuration for worktree-based agent isolation. */
export interface WorktreeConfig {
  /** The root of the git repository */
  repoRoot: string;
  /** Base branch to create worktrees from (defaults to "main") */
  baseBranch?: string;
}

const MAX_OUTPUT_BYTES = 50_000;

function appendToBuffer(existing: string, chunk: string): string {
  const combined = existing + chunk;
  if (combined.length > MAX_OUTPUT_BYTES) {
    return combined.slice(combined.length - MAX_OUTPUT_BYTES);
  }
  return combined;
}

interface TrackedProcess {
  session: AgentSession;
  process: ChildProcess | null;
  /** The worktree branch name, if this session uses a worktree. */
  worktreeBranch: string | null;
  /** Buffered stdout output (tail, capped at MAX_OUTPUT_BYTES). */
  stdoutBuffer: string;
  /** Buffered stderr output (tail, capped at MAX_OUTPUT_BYTES). */
  stderrBuffer: string;
}

/**
 * Manages the lifecycle of agent CLI processes.
 * Spawns agents, tracks PIDs, monitors health, and emits events.
 *
 * When configured with a WorktreeManager + repoRoot, agents are spawned
 * in isolated git worktrees so they can make changes without interfering
 * with each other or the main working directory.
 */
export class AgentSpawner {
  private sessions = new Map<string, TrackedProcess>();
  private _defaultWorkingDirectory: string | undefined;
  private readonly worktreeManager: WorktreeManager | null;
  private readonly worktreeConfig: WorktreeConfig | null;

  constructor(
    private readonly registry: AgentRegistry,
    private readonly eventBus: EventBus,
    worktreeManager?: WorktreeManager,
    worktreeConfig?: WorktreeConfig
  ) {
    this.worktreeManager = worktreeManager ?? null;
    this.worktreeConfig = worktreeConfig ?? null;
  }

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
   * 2. Creates a worktree (if configured and task-based)
   * 3. Creates a session record
   * 4. Spawns the CLI process with env vars
   * 5. Emits agent.spawned event
   * 6. Monitors for exit
   */
  async spawn(options: SpawnOptions): Promise<AgentSession> {
    const presetId = options.agentPresetId ?? this.registry.getDefaultPresetId();
    const preset = this.registry.getPresetOrThrow(presetId);

    const sessionId = uuid();
    const apiUrl = options.apiUrl ?? "http://localhost:4000";

    // Determine whether to use a worktree for this session.
    // Default: use a worktree when a taskId is provided and worktree support is configured.
    const shouldUseWorktree =
      (options.useWorktree ?? !!options.taskId) &&
      this.worktreeManager !== null &&
      this.worktreeConfig !== null;

    let cwd = options.workingDirectory ?? this._defaultWorkingDirectory ?? process.cwd();
    let worktreeBranch: string | null = null;

    // Create an isolated worktree for this agent session
    if (shouldUseWorktree) {
      const wm = this.worktreeManager!;
      const wc = this.worktreeConfig!;

      try {
        cwd = await wm.create({
          repoRoot: wc.repoRoot,
          roleId: options.roleId,
          taskId: options.taskId,
          sessionId,
          baseBranch: wc.baseBranch ?? "main",
        });
        // Derive the branch name so we can expose it to the agent
        const shortId =
          (options.taskId ?? sessionId).length > 8
            ? (options.taskId ?? sessionId).slice(0, 8)
            : (options.taskId ?? sessionId);
        const safeRole = options.roleId.toLowerCase().replace(/_/g, "-");
        worktreeBranch = `bv/agent/${safeRole}/${shortId}`;
      } catch (err) {
        // Worktree creation failed — fall back to the plain working directory
        // rather than blocking the spawn entirely.
        this.emitEvent({
          type: "system.error",
          payload: {
            error: `Worktree creation failed for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
            context: { sessionId, roleId: options.roleId },
          },
        });
      }
    }

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
    if (worktreeBranch) {
      agentEnv.BV_WORKTREE_BRANCH = worktreeBranch;
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
      this.sessions.set(sessionId, {
        session,
        process: null,
        worktreeBranch,
        stdoutBuffer: "",
        stderrBuffer: "",
      });

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

      // Clean up worktree on spawn failure
      if (worktreeBranch) {
        void this.cleanupWorktree(sessionId);
      }

      return session;
    }

    session.pid = child.pid ?? null;
    session.status = "running";

    const tracked: TrackedProcess = {
      session,
      process: child,
      worktreeBranch,
      stdoutBuffer: "",
      stderrBuffer: "",
    };
    this.sessions.set(sessionId, tracked);

    // Buffer stdout/stderr so output is available on failure
    child.stdout?.on("data", (data: Buffer) => {
      tracked.stdoutBuffer = appendToBuffer(tracked.stdoutBuffer, data.toString());
    });
    child.stderr?.on("data", (data: Buffer) => {
      tracked.stderrBuffer = appendToBuffer(tracked.stderrBuffer, data.toString());
    });

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
            stdout: tracked.stdoutBuffer || undefined,
            stderr: tracked.stderrBuffer || undefined,
          },
        });

        // Clean up worktree on failure (nothing to merge)
        if (tracked.worktreeBranch) {
          void this.cleanupWorktree(sessionId);
        }
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
          stdout: tracked.stdoutBuffer || undefined,
          stderr: tracked.stderrBuffer || undefined,
        },
      });

      // Clean up worktree on error (nothing to merge)
      if (tracked.worktreeBranch) {
        void this.cleanupWorktree(sessionId);
      }
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

    // Clean up worktree on kill (nothing to merge)
    if (tracked.worktreeBranch) {
      void this.cleanupWorktree(sessionId);
    }

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

  /**
   * Get the worktree branch name for a session, if one was created.
   */
  getWorktreeBranch(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.worktreeBranch ?? null;
  }

  /**
   * Clean up the git worktree for a session.
   * Removes the worktree directory and deletes the associated branch.
   *
   * Called automatically on kill/failed. For completed sessions, this
   * should be called after the branch has been merged (by GitMergeEngine).
   */
  async cleanupWorktree(sessionId: string): Promise<void> {
    if (!this.worktreeManager || !this.worktreeConfig) return;

    const tracked = this.sessions.get(sessionId);
    if (!tracked) return;

    const { roleId, taskId } = tracked.session;
    try {
      await this.worktreeManager.removeWithBranch(
        this.worktreeConfig.repoRoot,
        sessionId,
        roleId,
        taskId ?? undefined
      );
    } catch {
      // Best-effort cleanup — don't fail the caller
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
        // Clean up any lingering worktrees for failed/killed sessions.
        // Completed sessions should already have been cleaned up after merge.
        if (
          tracked.worktreeBranch &&
          (tracked.session.status === "failed" || tracked.session.status === "killed")
        ) {
          void this.cleanupWorktree(sessionId);
        }
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
