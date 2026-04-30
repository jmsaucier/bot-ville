import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rm, access } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Options for creating a git worktree for an agent session.
 */
export interface WorktreeOptions {
  /** The root of the git repository */
  repoRoot: string;
  /** The role the agent operates as (used in branch naming) */
  roleId: string;
  /** The task ID (used in branch naming, optional) */
  taskId?: string;
  /** Unique session ID (used as worktree directory name) */
  sessionId: string;
  /** Base branch to create the worktree from (defaults to HEAD) */
  baseBranch?: string;
}

/**
 * Manages git worktrees for agent isolation.
 *
 * Each agent gets its own worktree so it can make changes without
 * interfering with other agents or the main working directory.
 * Branch naming convention: bv/agent/<role>/<task-id-or-session-id>
 */
export class WorktreeManager {
  private readonly worktreeBase: string;

  /**
   * @param worktreeBase - Directory where agent worktrees are created.
   *   Defaults to `.bot-ville/worktrees` under the repo root.
   */
  constructor(worktreeBase?: string) {
    this.worktreeBase = worktreeBase ?? ".bot-ville/worktrees";
  }

  /**
   * Create a git worktree for an agent session.
   * Returns the absolute path to the worktree directory.
   */
  async create(options: WorktreeOptions): Promise<string> {
    const { repoRoot, roleId, taskId, sessionId, baseBranch } = options;

    const branchName = this.buildBranchName(roleId, taskId ?? sessionId);
    const worktreePath = join(repoRoot, this.worktreeBase, sessionId);

    const args = ["worktree", "add"];

    // Create a new branch based on baseBranch or HEAD
    if (baseBranch) {
      args.push("-b", branchName, worktreePath, baseBranch);
    } else {
      args.push("-b", branchName, worktreePath);
    }

    await execFileAsync("git", args, { cwd: repoRoot });

    return worktreePath;
  }

  /**
   * Remove a worktree and its branch.
   * Safely handles cases where the worktree has already been removed.
   */
  async remove(repoRoot: string, sessionId: string): Promise<void> {
    const worktreePath = join(repoRoot, this.worktreeBase, sessionId);

    try {
      await access(worktreePath);
    } catch {
      // Worktree doesn't exist, nothing to remove
      return;
    }

    try {
      // Remove the worktree
      await execFileAsync("git", ["worktree", "remove", worktreePath, "--force"], {
        cwd: repoRoot,
      });
    } catch {
      // If git worktree remove fails, try manual cleanup
      try {
        await rm(worktreePath, { recursive: true, force: true });
        // Prune stale worktree entries
        await execFileAsync("git", ["worktree", "prune"], { cwd: repoRoot });
      } catch {
        // Best effort cleanup
      }
    }
  }

  /**
   * Remove the worktree and delete the associated branch.
   */
  async removeWithBranch(
    repoRoot: string,
    sessionId: string,
    roleId: string,
    taskId?: string
  ): Promise<void> {
    await this.remove(repoRoot, sessionId);

    const branchName = this.buildBranchName(roleId, taskId ?? sessionId);
    try {
      await execFileAsync("git", ["branch", "-D", branchName], { cwd: repoRoot });
    } catch {
      // Branch may already be deleted or merged
    }
  }

  /**
   * List all active agent worktrees.
   */
  async list(repoRoot: string): Promise<WorktreeInfo[]> {
    const { stdout } = await execFileAsync(
      "git",
      ["worktree", "list", "--porcelain"],
      { cwd: repoRoot }
    );

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.slice("worktree ".length) };
      } else if (line.startsWith("HEAD ")) {
        current.head = line.slice("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice("branch ".length);
      } else if (line === "bare") {
        current.bare = true;
      } else if (line === "detached") {
        current.detached = true;
      }
    }

    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }

    // Filter to only bot-ville agent worktrees
    return worktrees.filter(
      (w) => w.branch && w.branch.includes("bv/agent/")
    );
  }

  /**
   * Get the worktree path for a given session ID.
   */
  getWorktreePath(repoRoot: string, sessionId: string): string {
    return join(repoRoot, this.worktreeBase, sessionId);
  }

  /**
   * Build a branch name for an agent worktree.
   * Convention: bv/agent/<role>/<identifier>
   */
  private buildBranchName(roleId: string, identifier: string): string {
    const safeRole = roleId.toLowerCase().replace(/_/g, "-");
    // Truncate identifier for readability (use first 8 chars of UUID)
    const shortId = identifier.length > 8 ? identifier.slice(0, 8) : identifier;
    return `bv/agent/${safeRole}/${shortId}`;
  }
}

export interface WorktreeInfo {
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
}
