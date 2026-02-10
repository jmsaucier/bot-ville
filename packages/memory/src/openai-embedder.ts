/**
 * OpenAI embeddings adapter.
 *
 * Uses the native `fetch` API (Node 18+) — no SDK dependency required.
 * Reads `OPENAI_API_KEY` from the environment.
 */

import type { Embedder } from "./types.js";

const DEFAULT_MODEL = "text-embedding-3-small";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface OpenAIEmbedderOptions {
  /** Override the model name (default: "text-embedding-3-small"). */
  model?: string;
  /** Provide an API key directly instead of reading from `OPENAI_API_KEY`. */
  apiKey?: string;
}

export class OpenAIEmbedder implements Embedder {
  readonly model: string;
  private readonly apiKey: string;

  constructor(options: OpenAIEmbedderOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;

    const key = options.apiKey ?? process.env["OPENAI_API_KEY"];
    if (!key) {
      throw new Error(
        "OpenAIEmbedder: missing API key. Set OPENAI_API_KEY or pass apiKey option."
      );
    }
    this.apiKey = key;
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    if (!result) {
      throw new Error("OpenAIEmbedder: empty response from API");
    }
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI embeddings request failed (${response.status.toString()}): ${body}`
      );
    }

    const json = (await response.json()) as OpenAIEmbeddingResponse;

    // The API may return results out of order — sort by index.
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}
