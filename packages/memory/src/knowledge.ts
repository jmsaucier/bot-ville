/**
 * KnowledgeBase — the core memory subsystem.
 *
 * Stores memory entries as individual JSON files and maintains a separate
 * vector index for embedding-based recall.
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { scoreMemories } from "./scoring.js";
import { readJson, writeJson, deleteFile, listJson } from "./store.js";
import type {
  Embedder,
  MemoryEntry,
  MemoryEntryInput,
  MemoryEntryPatch,
  RecallOptions,
  RecallResult,
  VectorIndex,
} from "./types.js";

export class KnowledgeBase {
  private readonly entriesDir: string;
  private readonly indexPath: string;
  private readonly embedder: Embedder;

  constructor(rootDir: string, embedder: Embedder) {
    this.entriesDir = join(rootDir, "knowledge", "entries");
    this.indexPath = join(rootDir, "knowledge", "index.json");
    this.embedder = embedder;
  }

  // -----------------------------------------------------------------------
  // Add
  // -----------------------------------------------------------------------

  /**
   * Create a new memory entry, embed it, and persist both the entry and
   * the updated vector index.
   */
  async add(input: MemoryEntryInput): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    // Persist entry.
    await writeJson(this.entryPath(entry.id), entry);

    // Embed and update index.
    const vector = await this.embedder.embed(
      this.embeddableText(entry)
    );
    const index = await this.loadIndex();
    index.entries[entry.id] = vector;
    await writeJson(this.indexPath, index);

    return entry;
  }

  // -----------------------------------------------------------------------
  // Recall (the core differentiator)
  // -----------------------------------------------------------------------

  /**
   * Retrieve memories ranked by semantic similarity + time-decay recency.
   * Touches `lastAccessedAt` on every returned entry.
   */
  async recall(options: RecallOptions): Promise<RecallResult[]> {
    const entries = await this.listAll();
    const index = await this.loadIndex();

    const results = await scoreMemories(entries, index, this.embedder, options);

    // Touch lastAccessedAt for recalled entries (fire-and-forget writes).
    const now = new Date().toISOString();
    await Promise.all(
      results.map(async (r) => {
        r.entry.lastAccessedAt = now;
        await writeJson(this.entryPath(r.entry.id), r.entry);
      })
    );

    return results;
  }

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------

  /** Get a single entry by ID, or `null` if it doesn't exist. */
  async get(id: string): Promise<MemoryEntry | null> {
    return readJson<MemoryEntry>(this.entryPath(id));
  }

  /** Update fields on an existing entry. Re-embeds if content/title changed. */
  async update(id: string, patch: MemoryEntryPatch): Promise<MemoryEntry | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const updated: MemoryEntry = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(this.entryPath(id), updated);

    // Re-embed if the textual content changed.
    if (patch.title !== undefined || patch.content !== undefined) {
      const vector = await this.embedder.embed(
        this.embeddableText(updated)
      );
      const index = await this.loadIndex();
      index.entries[id] = vector;
      await writeJson(this.indexPath, index);
    }

    return updated;
  }

  /** Remove an entry and its vector from the index. */
  async remove(id: string): Promise<void> {
    await deleteFile(this.entryPath(id));

    const index = await this.loadIndex();
    delete index.entries[id];
    await writeJson(this.indexPath, index);
  }

  /** List all entries (unscored). */
  async listAll(): Promise<MemoryEntry[]> {
    const items = await listJson<MemoryEntry>(this.entriesDir);
    return items.map((i) => i.data);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private entryPath(id: string): string {
    return join(this.entriesDir, `${id}.json`);
  }

  /** Load the vector index from disk, or return a fresh one. */
  private async loadIndex(): Promise<VectorIndex> {
    const existing = await readJson<VectorIndex>(this.indexPath);
    return existing ?? { model: this.embedder.model, entries: {} };
  }

  /**
   * Build the text that gets embedded for a memory entry.
   * Concatenating title + content gives the embedder more signal.
   */
  private embeddableText(entry: MemoryEntry): string {
    return `${entry.title}\n${entry.content}`;
  }
}
