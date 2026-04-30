/**
 * Low-level async helpers for reading / writing / listing / deleting
 * JSON files on disk.  Every other module in @repo/memory uses this
 * layer instead of touching `node:fs` directly.
 */

import { mkdir, readFile, writeFile, readdir, unlink, access } from "node:fs/promises";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file.  Returns `null` if the file does not exist.
 */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Serialise `data` as pretty-printed JSON and write it to `filePath`.
 * Parent directories are created automatically.
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * List file names (not full paths) inside `dirPath`.
 * Returns an empty array if the directory does not exist.
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath);
    return entries;
  } catch (err: unknown) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

/**
 * List all JSON files in a directory and parse each one.
 * Returns an array of `{ name, data }` objects.
 */
export async function listJson<T>(dirPath: string): Promise<{ name: string; data: T }[]> {
  const files = await listFiles(dirPath);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const results: { name: string; data: T }[] = [];
  for (const name of jsonFiles) {
    const data = await readJson<T>(join(dirPath, name));
    if (data !== null) {
      results.push({ name, data });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a file.  Silently succeeds if the file does not exist.
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (err: unknown) {
    if (isNotFound(err)) return;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Exists
// ---------------------------------------------------------------------------

/**
 * Check whether a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}
