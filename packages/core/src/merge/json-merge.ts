/**
 * Key-based structured JSON merge with conflict detection.
 */

export interface JsonConflict {
  path: string;
  values: unknown[];
}

export interface JsonMergeResult {
  merged: Record<string, unknown>;
  conflicts: JsonConflict[];
}

/**
 * Deep merge multiple JSON objects by key.
 * - Unique keys are included.
 * - Same key with identical values: included once.
 * - Same key with different values: conflict reported, first value wins.
 */
export function mergeJsonObjects(
  sources: Record<string, unknown>[]
): JsonMergeResult {
  if (sources.length === 0) {
    return { merged: {}, conflicts: [] };
  }

  if (sources.length === 1) {
    return { merged: { ...sources[0] }, conflicts: [] };
  }

  const merged: Record<string, unknown> = {};
  const conflicts: JsonConflict[] = [];

  // Collect all keys
  const allKeys = new Set<string>();
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      allKeys.add(key);
    }
  }

  for (const key of allKeys) {
    const values: unknown[] = [];
    for (const source of sources) {
      if (key in source) {
        values.push(source[key]);
      }
    }

    if (values.length === 1) {
      merged[key] = values[0];
    } else {
      // Check if all values are identical
      const serialized = values.map((v) => JSON.stringify(v));
      const uniqueSerialized = [...new Set(serialized)];

      if (uniqueSerialized.length === 1) {
        merged[key] = values[0];
      } else {
        // Check if values are all objects (can deep merge)
        const allObjects = values.every(
          (v) =>
            typeof v === "object" && v !== null && !Array.isArray(v)
        );

        if (allObjects) {
          const subResult = mergeJsonObjects(
            values as Record<string, unknown>[]
          );
          merged[key] = subResult.merged;
          for (const c of subResult.conflicts) {
            conflicts.push({ path: `${key}.${c.path}`, values: c.values });
          }
        } else {
          // Conflict: take first value, report conflict
          merged[key] = values[0];
          conflicts.push({ path: key, values });
        }
      }
    }
  }

  return { merged, conflicts };
}

/**
 * Merge JSON strings. Parses each source, merges, returns stringified result.
 */
export function mergeJsonStrings(sources: string[]): {
  merged: string;
  conflicts: JsonConflict[];
} {
  const parsed = sources.map((s) => JSON.parse(s) as Record<string, unknown>);
  const result = mergeJsonObjects(parsed);
  return {
    merged: JSON.stringify(result.merged, null, 2),
    conflicts: result.conflicts,
  };
}
