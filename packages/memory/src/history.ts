/**
 * HistoryManager — conversation / session history for agents.
 *
 * Sessions are stored per agent:
 *   <rootDir>/agents/<agentId>/sessions/<sessionId>.json
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJson, writeJson, listJson } from "./store.js";
import type { Session, SessionMessage } from "./types.js";

export class HistoryManager {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  // -----------------------------------------------------------------------
  // Sessions
  // -----------------------------------------------------------------------

  /**
   * Start a new session for an agent. Returns the session ID.
   */
  async startSession(agentId: string): Promise<Session> {
    const session: Session = {
      sessionId: randomUUID(),
      agentId,
      messages: [],
      startedAt: new Date().toISOString(),
    };
    await writeJson(this.sessionPath(agentId, session.sessionId), session);
    return session;
  }

  /** Get a session by ID, or `null` if not found. */
  async getSession(agentId: string, sessionId: string): Promise<Session | null> {
    return readJson<Session>(this.sessionPath(agentId, sessionId));
  }

  /** List all sessions for an agent, newest first. */
  async listSessions(agentId: string): Promise<Session[]> {
    const items = await listJson<Session>(this.sessionsDir(agentId));
    const sessions = items.map((i) => i.data);

    sessions.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    return sessions;
  }

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------

  /**
   * Append a message to an existing session.
   * The `timestamp` field is set automatically if not provided.
   */
  async append(
    agentId: string,
    sessionId: string,
    message: Omit<SessionMessage, "timestamp"> & { timestamp?: string }
  ): Promise<Session> {
    const session = await this.getSession(agentId, sessionId);
    if (!session) {
      throw new Error(
        `Session not found: agent=${agentId}, session=${sessionId}`
      );
    }

    session.messages.push({
      ...message,
      timestamp: message.timestamp ?? new Date().toISOString(),
    });

    await writeJson(this.sessionPath(agentId, sessionId), session);
    return session;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private sessionsDir(agentId: string): string {
    return join(this.rootDir, "agents", agentId, "sessions");
  }

  private sessionPath(agentId: string, sessionId: string): string {
    return join(this.sessionsDir(agentId), `${sessionId}.json`);
  }
}
