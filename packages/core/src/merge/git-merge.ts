import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  GitMergeRequest,
  GitMergeRequestStatus,
  FarmEvent,
  RoleId,
} from "@bot-ville/shared";
import type { EventBus } from "../event-bus.js";
import { enforcePolicy } from "../policy-engine.js";

const execFileAsync = promisify(execFile);

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** Result of a git merge attempt. */
export interface GitMergeResult {
  success: boolean;
  mergeRequest: GitMergeRequest;
  conflictFiles: string[];
  message: string | null;
}

/**
 * Manages git branch merges for agent worktrees.
 *
 * This is the analog of Gas Town's Refinery Engineer. It handles merging
 * agent worktree branches back into the target branch (usually main).
 *
 * The engine is pure git operations + event emission. It does not depend
 * on Prisma/SQLite — persistence of merge request records is handled by
 * the caller (backend routes).
 */
export class GitMergeEngine {
  private mergeRequests = new Map<string, GitMergeRequest>();

  constructor(
    private readonly repoRoot: string,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Create a merge request for a completed agent session's worktree branch.
   *
   * This records the intent to merge and emits a `merge.git_requested` event.
   * The actual merge is performed separately via `executeMerge()`.
   */
  requestMerge(
    sessionId: string,
    sourceBranch: string,
    roleId: RoleId,
    options?: {
      targetBranch?: string;
      taskId?: string | null;
      workOrderId?: string | null;
    }
  ): GitMergeRequest {
    // Enforce that the requesting role has permission to merge git branches
    enforcePolicy("merge_git_branch", roleId);

    const targetBranch = options?.targetBranch ?? "main";

    const mr: GitMergeRequest = {
      id: uuid(),
      sessionId,
      sourceBranch,
      targetBranch,
      roleId,
      taskId: options?.taskId ?? null,
      workOrderId: options?.workOrderId ?? null,
      status: "OPEN",
      conflictFiles: [],
      message: null,
      createdAt: now(),
      resolvedAt: null,
    };

    this.mergeRequests.set(mr.id, mr);

    this.emitEvent({
      type: "merge.git_requested",
      payload: {
        mergeRequestId: mr.id,
        sessionId,
        sourceBranch,
        targetBranch,
        roleId,
        workOrderId: options?.workOrderId ?? null,
      },
    });

    return mr;
  }

  /**
   * Execute a merge request: merge the source branch into the target branch.
   *
   * Steps:
   * 1. Check for conflicts (test merge)
   * 2. If clean, perform squash merge + commit
   * 3. Emit appropriate events
   *
   * @param mergeRequestId - The merge request to execute
   * @param squash - Whether to squash merge (default: true)
   */
  async executeMerge(
    mergeRequestId: string,
    squash = true
  ): Promise<GitMergeResult> {
    const mr = this.mergeRequests.get(mergeRequestId);
    if (!mr) {
      throw new Error(`Merge request ${mergeRequestId} not found`);
    }

    if (mr.status !== "OPEN") {
      throw new Error(
        `Merge request ${mergeRequestId} is ${mr.status}, expected OPEN`
      );
    }

    // Mark as in-progress
    mr.status = "IN_PROGRESS";

    const { sourceBranch, targetBranch } = mr;

    // Step 1: Check for conflicts
    const conflicts = await this.checkConflicts(sourceBranch, targetBranch);
    if (conflicts.length > 0) {
      return this.handleConflict(mr, conflicts);
    }

    // Step 2: Perform the merge
    try {
      if (squash) {
        await this.squashMerge(sourceBranch, targetBranch);
      } else {
        await this.regularMerge(sourceBranch, targetBranch);
      }
    } catch (err) {
      return this.handleConflict(mr, [], err);
    }

    // Step 3: Mark as merged and emit event
    mr.status = "MERGED";
    mr.resolvedAt = now();
    mr.message = `Successfully ${squash ? "squash " : ""}merged ${sourceBranch} into ${targetBranch}`;

    this.emitEvent({
      type: "merge.git_completed",
      payload: {
        mergeRequestId: mr.id,
        sessionId: mr.sessionId,
        sourceBranch,
        targetBranch,
        status: "MERGED",
      },
    });

    return {
      success: true,
      mergeRequest: mr,
      conflictFiles: [],
      message: mr.message,
    };
  }

  /**
   * Check if merging source into target would produce conflicts.
   * Performs a test merge without committing, then aborts.
   * Returns a list of conflicting file paths, or empty array if clean.
   */
  async checkConflicts(
    sourceBranch: string,
    targetBranch: string
  ): Promise<string[]> {
    // Ensure we're on the target branch
    try {
      await this.git("checkout", targetBranch);
    } catch {
      throw new Error(`Cannot checkout target branch "${targetBranch}"`);
    }

    // Attempt a test merge (no-commit, no-ff)
    try {
      await this.git("merge", "--no-commit", "--no-ff", sourceBranch);
      // Merge succeeded without conflicts — abort the test merge
      await this.git("merge", "--abort").catch(() => {
        // --abort may fail if merge completed; use reset instead
        return this.git("reset", "--hard", "HEAD");
      });
      return [];
    } catch {
      // Merge had issues — check for unmerged files
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["diff", "--name-only", "--diff-filter=U"],
          { cwd: this.repoRoot }
        );
        const conflicts = stdout
          .trim()
          .split("\n")
          .filter((f) => f.length > 0);

        // Abort the failed merge
        await this.git("merge", "--abort").catch(() => {});

        return conflicts;
      } catch {
        // Can't determine conflicts — abort and report generic error
        await this.git("merge", "--abort").catch(() => {});
        return [];
      }
    }
  }

  /** Get a merge request by ID. */
  getMergeRequest(id: string): GitMergeRequest | undefined {
    return this.mergeRequests.get(id);
  }

  /** List all merge requests, optionally filtered by status. */
  listMergeRequests(status?: GitMergeRequestStatus): GitMergeRequest[] {
    const all = Array.from(this.mergeRequests.values());
    if (status) {
      return all.filter((mr) => mr.status === status);
    }
    return all;
  }

  /** Reject a merge request. */
  rejectMergeRequest(id: string, reason?: string): GitMergeRequest {
    const mr = this.mergeRequests.get(id);
    if (!mr) throw new Error(`Merge request ${id} not found`);
    if (mr.status === "MERGED" || mr.status === "REJECTED") {
      throw new Error(`Merge request ${id} is already ${mr.status}`);
    }

    mr.status = "REJECTED";
    mr.resolvedAt = now();
    mr.message = reason ?? "Merge request rejected";

    this.emitEvent({
      type: "merge.git_completed",
      payload: {
        mergeRequestId: mr.id,
        sessionId: mr.sessionId,
        sourceBranch: mr.sourceBranch,
        targetBranch: mr.targetBranch,
        status: "REJECTED",
      },
    });

    return mr;
  }

  // ── Private Helpers ──

  private async squashMerge(
    sourceBranch: string,
    targetBranch: string
  ): Promise<void> {
    await this.git("checkout", targetBranch);
    await this.git("merge", "--squash", sourceBranch);
    await this.git(
      "commit",
      "-m",
      `merge: squash ${sourceBranch} into ${targetBranch}`
    );
  }

  private async regularMerge(
    sourceBranch: string,
    targetBranch: string
  ): Promise<void> {
    await this.git("checkout", targetBranch);
    await this.git(
      "merge",
      "--no-ff",
      "-m",
      `merge: ${sourceBranch} into ${targetBranch}`,
      sourceBranch
    );
  }

  private handleConflict(
    mr: GitMergeRequest,
    conflictFiles: string[],
    err?: unknown
  ): GitMergeResult {
    mr.status = "CONFLICT";
    mr.resolvedAt = now();
    mr.conflictFiles = conflictFiles;
    mr.message =
      conflictFiles.length > 0
        ? `Merge conflicts in ${conflictFiles.length} file(s): ${conflictFiles.join(", ")}`
        : err instanceof Error
          ? err.message
          : "Merge failed due to unknown error";

    this.emitEvent({
      type: "merge.git_conflict",
      payload: {
        mergeRequestId: mr.id,
        sessionId: mr.sessionId,
        sourceBranch: mr.sourceBranch,
        targetBranch: mr.targetBranch,
        conflictFiles,
      },
    });

    return {
      success: false,
      mergeRequest: mr,
      conflictFiles,
      message: mr.message,
    };
  }

  private async git(...args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync("git", args, { cwd: this.repoRoot });
  }

  private emitEvent(event: FarmEvent): void {
    this.eventBus.emit(event);
  }
}
