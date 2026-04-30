/**
 * AgentStateManager — persistent key-value state per agent.
 *
 * Each agent's state is stored as a single JSON file:
 *   <rootDir>/agents/<agentId>/state.json
 */

import { join } from "node:path";

import { readJson, writeJson, deleteFile } from "./store.js";
import type { AgentState } from "./types.js";

export class AgentStateManager {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /** Get the current state for an agent, or `null` if none exists. */
  async get(agentId: string): Promise<AgentState | null> {
    return readJson<AgentState>(this.statePath(agentId));
  }

  /**
   * Set (merge) data into an agent's state.
   * Creates the state file if it doesn't exist yet.
   */
  async set(agentId: string, data: Record<string, unknown>): Promise<AgentState> {
    const existing = await this.get(agentId);
    const state: AgentState = {
      agentId,
      data: { ...(existing?.data ?? {}), ...data },
      updatedAt: new Date().toISOString(),
    };
    await writeJson(this.statePath(agentId), state);
    return state;
  }

  /** Remove all state for an agent. */
  async clear(agentId: string): Promise<void> {
    await deleteFile(this.statePath(agentId));
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private statePath(agentId: string): string {
    return join(this.rootDir, "agents", agentId, "state.json");
  }
}
