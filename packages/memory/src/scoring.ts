/**
 * Scoring module — combines semantic similarity with time-decay recency
 * to produce a human-like recall ranking.
 *
 * score = (alpha * cosineSimilarity) + ((1 - alpha) * recencyScore)
 */

import { cosineSimilarity } from "./embedder.js";
import type {
  Embedder,
  MemoryEntry,
  RecallOptions,
  RecallResult,
  VectorIndex,
} from "./types.js";

/**
 * Half-life for the recency decay function, in hours.
 * After this many hours the recency score drops to 0.5.
 */
const RECENCY_HALF_LIFE_HOURS = 24;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a set of memory entries against a query using relevance + recency.
 *
 * 1. Embed the query.
 * 2. For each entry that has a vector in the index, compute cosine similarity.
 * 3. Compute a recency score based on `lastAccessedAt`.
 * 4. Combine using `alpha`.
 * 5. Optionally filter by tags, sort descending, and limit.
 */
export async function scoreMemories(
  entries: MemoryEntry[],
  index: VectorIndex,
  embedder: Embedder,
  options: RecallOptions
): Promise<RecallResult[]> {
  const { query, limit = 10, alpha = 0.7, tags } = options;

  // Pre-filter by tags if specified (entries must match ALL given tags).
  let candidates = entries;
  if (tags && tags.length > 0) {
    candidates = candidates.filter((e) =>
      tags.every((t) => e.tags.includes(t))
    );
  }

  if (candidates.length === 0) return [];

  // Embed the query once.
  const queryVector = await embedder.embed(query);

  const now = Date.now();

  const scored: RecallResult[] = [];

  for (const entry of candidates) {
    const entryVector = index.entries[entry.id];
    if (!entryVector) continue; // skip entries without embeddings

    const similarity = cosineSimilarity(queryVector, entryVector);
    const recency = computeRecency(entry.lastAccessedAt, now);
    const score = alpha * similarity + (1 - alpha) * recency;

    scored.push({ entry, score, similarity, recency });
  }

  // Sort by combined score descending.
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Recency scoring
// ---------------------------------------------------------------------------

/**
 * Exponential decay recency score.
 *
 * Returns a value in (0, 1] where 1 means "just now" and the value halves
 * every `RECENCY_HALF_LIFE_HOURS` hours.
 */
function computeRecency(lastAccessedAt: string, nowMs: number): number {
  const accessedMs = new Date(lastAccessedAt).getTime();
  const hoursAgo = Math.max(0, (nowMs - accessedMs) / (1000 * 60 * 60));
  // Exponential decay: 0.5^(hoursAgo / halfLife)
  return Math.pow(0.5, hoursAgo / RECENCY_HALF_LIFE_HOURS);
}
