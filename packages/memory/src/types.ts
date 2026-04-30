// ---------------------------------------------------------------------------
// Embedding abstraction
// ---------------------------------------------------------------------------

/** Provider-agnostic embedding interface. */
export interface Embedder {
  /** Embed a single text string and return its vector. */
  embed(text: string): Promise<number[]>;

  /** Embed multiple texts in a single batch call. */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** The model identifier used for embedding (e.g. "text-embedding-3-small"). */
  readonly model: string;
}

// ---------------------------------------------------------------------------
// Memory entries (knowledge base)
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export type MemoryEntryInput = Omit<
  MemoryEntry,
  "id" | "createdAt" | "updatedAt" | "lastAccessedAt"
>;

export type MemoryEntryPatch = Partial<
  Omit<MemoryEntry, "id" | "createdAt">
>;

/** On-disk vector index mapping entry IDs to their embedding vectors. */
export interface VectorIndex {
  model: string;
  entries: Record<string, number[]>;
}

// ---------------------------------------------------------------------------
// Recall (query) options & results
// ---------------------------------------------------------------------------

export interface RecallOptions {
  /** The natural-language query to search for. */
  query: string;
  /** Maximum number of results to return (default 10). */
  limit?: number;
  /**
   * Weight between relevance and recency.
   * 0 = pure recency, 1 = pure relevance (default 0.7).
   */
  alpha?: number;
  /** Optional tag filter — only entries matching ALL given tags are scored. */
  tags?: string[];
}

export interface RecallResult {
  entry: MemoryEntry;
  /** Combined score (relevance + recency). */
  score: number;
  /** Raw cosine similarity between query and entry embeddings. */
  similarity: number;
  /** Raw recency score (0–1, 1 = just accessed). */
  recency: number;
}

// ---------------------------------------------------------------------------
// Agent state
// ---------------------------------------------------------------------------

export interface AgentState {
  agentId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Tasks & steps
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TaskStep {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  steps: TaskStep[];
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: TaskStatus;
};

export type TaskPatch = Partial<Omit<Task, "id" | "createdAt">>;

// ---------------------------------------------------------------------------
// Session / conversation history
// ---------------------------------------------------------------------------

export interface SessionMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface Session {
  sessionId: string;
  agentId: string;
  messages: SessionMessage[];
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

export interface MemoryConfig {
  /** Root directory for all memory data (default ".bot-ville"). */
  rootDir: string;
  /** The embedder to use for knowledge recall. */
  embedder: Embedder;
}
