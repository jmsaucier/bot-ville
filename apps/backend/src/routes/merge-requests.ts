import type { FastifyInstance } from "fastify";
import type { AgentSpawner, GitMergeEngine } from "@bot-ville/core";
import {
  CreateGitMergeRequestInput,
  ExecuteGitMergeRequestInput,
  type GitMergeRequestStatus,
} from "@bot-ville/shared";

/**
 * Git merge request API routes.
 * Handles creating, listing, executing, and rejecting merge requests
 * for agent worktree branches.
 */
export function registerMergeRequestRoutes(
  app: FastifyInstance,
  gitMergeEngine: GitMergeEngine,
  agentSpawner: AgentSpawner
): void {
  // ── Create Merge Request ──

  app.post("/api/merge-requests", async (request, reply) => {
    const body = CreateGitMergeRequestInput.parse(request.body);

    // Look up the agent session to get the branch and role info
    const session = agentSpawner.getSession(body.sessionId);
    if (!session) {
      return reply.status(404).send({ error: "Agent session not found" });
    }

    // Get the worktree branch for this session
    const sourceBranch = agentSpawner.getWorktreeBranch(body.sessionId);
    if (!sourceBranch) {
      return reply.status(400).send({
        error: "Session does not have an associated worktree branch",
      });
    }

    if (session.status !== "completed") {
      return reply.status(400).send({
        error: `Session is "${session.status}", must be "completed" to create a merge request`,
      });
    }

    const mr = gitMergeEngine.requestMerge(
      body.sessionId,
      sourceBranch,
      session.roleId,
      {
        targetBranch: body.targetBranch,
        taskId: session.taskId,
        workOrderId: session.workOrderId,
      }
    );

    return reply.status(201).send(mr);
  });

  // ── List Merge Requests ──

  app.get("/api/merge-requests", async (request, reply) => {
    const query = request.query as { status?: string };
    const status = query.status as GitMergeRequestStatus | undefined;
    const mergeRequests = gitMergeEngine.listMergeRequests(status);
    return reply.send(mergeRequests);
  });

  // ── Get Merge Request ──

  app.get<{ Params: { id: string } }>(
    "/api/merge-requests/:id",
    async (request, reply) => {
      const { id } = request.params;
      const mr = gitMergeEngine.getMergeRequest(id);
      if (!mr) {
        return reply.status(404).send({ error: "Merge request not found" });
      }
      return reply.send(mr);
    }
  );

  // ── Execute Merge ──

  app.post<{ Params: { id: string } }>(
    "/api/merge-requests/:id/execute",
    async (request, reply) => {
      const { id } = request.params;
      const body = ExecuteGitMergeRequestInput.parse(request.body ?? {});

      try {
        const result = await gitMergeEngine.executeMerge(id, body.squash);

        // If merge succeeded, clean up the agent's worktree
        if (result.success) {
          const mr = result.mergeRequest;
          await agentSpawner.cleanupWorktree(mr.sessionId);
        }

        return reply.send(result);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );

  // ── Reject Merge Request ──

  app.post<{ Params: { id: string } }>(
    "/api/merge-requests/:id/reject",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as { reason?: string } | undefined;

      try {
        const mr = gitMergeEngine.rejectMergeRequest(id, body?.reason);

        // Clean up the worktree since the branch won't be merged
        await agentSpawner.cleanupWorktree(mr.sessionId);

        return reply.send(mr);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  );
}
