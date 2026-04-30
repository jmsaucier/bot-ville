/**
 * Re-exports the Embedder interface from types and provides a pure-math
 * cosine similarity utility (zero dependencies).
 */

export type { Embedder } from "./types.js";

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Compute the cosine similarity between two vectors of equal length.
 * Returns a value in [-1, 1] where 1 means identical direction.
 *
 * If either vector has zero magnitude the function returns 0.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: ${a.length.toString()} vs ${b.length.toString()}`
    );
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}
