/**
 * @bot-ville/memory — first-party, embedding-backed memory system for bot-ville.
 *
 * Usage:
 *
 * ```ts
 * import { createMemory } from "@bot-ville/memory";
 * import { OpenAIEmbedder } from "@bot-ville/memory/openai-embedder";
 *
 * const mem = createMemory({
 *   rootDir: ".bot-ville",
 *   embedder: new OpenAIEmbedder(),
 * });
 *
 * // Recall by relevance + recency
 * const results = await mem.knowledge.recall({
 *   query: "how does authentication work",
 *   limit: 5,
 * });
 * ```
 */

import { AgentStateManager } from "./agent-state.js";
import { HistoryManager } from "./history.js";
import { KnowledgeBase } from "./knowledge.js";
import { TaskManager } from "./tasks.js";
import type { MemoryConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Memory instance
// ---------------------------------------------------------------------------

export interface Memory {
  /** Embedding-backed knowledge store with relevance + recency recall. */
  knowledge: KnowledgeBase;
  /** Persistent key-value state per agent. */
  agents: AgentStateManager;
  /** Task and workflow tracking with step support. */
  tasks: TaskManager;
  /** Conversation / session history per agent. */
  history: HistoryManager;
}

/**
 * Create a fully-wired Memory instance.
 *
 * @param config.rootDir  - Directory for all memory data (default ".bot-ville").
 * @param config.embedder - Embedder implementation to use for knowledge recall.
 */
export function createMemory(config: MemoryConfig): Memory {
  const { rootDir, embedder } = config;

  return {
    knowledge: new KnowledgeBase(rootDir, embedder),
    agents: new AgentStateManager(rootDir),
    tasks: new TaskManager(rootDir),
    history: new HistoryManager(rootDir),
  };
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { AgentStateManager } from "./agent-state.js";
export { cosineSimilarity } from "./embedder.js";
export { HistoryManager } from "./history.js";
export { KnowledgeBase } from "./knowledge.js";
export { scoreMemories } from "./scoring.js";
export { TaskManager } from "./tasks.js";

export type {
  AgentState,
  Embedder,
  MemoryConfig,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryPatch,
  RecallOptions,
  RecallResult,
  Session,
  SessionMessage,
  Task,
  TaskInput,
  TaskPatch,
  TaskStatus,
  TaskStep,
  VectorIndex,
} from "./types.js";
