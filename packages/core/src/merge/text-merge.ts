/**
 * Section-based deterministic text merge.
 * Splits text by headings (markdown-style) and merges sections by heading key.
 */

export interface TextSection {
  heading: string;
  content: string;
}

export interface TextMergeResult {
  merged: string;
  conflicts: TextConflict[];
}

export interface TextConflict {
  heading: string;
  versions: string[];
}

/**
 * Parse text into sections by markdown headings.
 * Content before the first heading goes under heading "".
 */
export function parseSections(text: string): TextSection[] {
  const lines = text.split("\n");
  const sections: TextSection[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      // Save previous section
      sections.push({
        heading: currentHeading,
        content: currentLines.join("\n").trim(),
      });
      currentHeading = headingMatch[2]!.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Save last section
  sections.push({
    heading: currentHeading,
    content: currentLines.join("\n").trim(),
  });

  return sections.filter((s) => s.heading !== "" || s.content !== "");
}

/**
 * Merge multiple text documents by section headings.
 * - If a section heading appears in only one source, it's included as-is.
 * - If a section heading appears in multiple sources with identical content, it's included once.
 * - If a section heading appears in multiple sources with different content, it's a conflict.
 */
export function mergeTexts(sources: string[]): TextMergeResult {
  if (sources.length === 0) {
    return { merged: "", conflicts: [] };
  }

  if (sources.length === 1) {
    return { merged: sources[0]!, conflicts: [] };
  }

  // Parse all sources into sections
  const allSections = sources.map(parseSections);

  // Collect all unique headings in order of first appearance
  const headingOrder: string[] = [];
  const headingContents = new Map<string, string[]>();

  for (const sections of allSections) {
    for (const section of sections) {
      if (!headingContents.has(section.heading)) {
        headingOrder.push(section.heading);
        headingContents.set(section.heading, []);
      }
      headingContents.get(section.heading)!.push(section.content);
    }
  }

  // Build merged output
  const mergedParts: string[] = [];
  const conflicts: TextConflict[] = [];

  for (const heading of headingOrder) {
    const contents = headingContents.get(heading)!;
    const uniqueContents = [...new Set(contents)];

    if (uniqueContents.length === 1) {
      // No conflict
      if (heading) {
        mergedParts.push(`## ${heading}\n\n${uniqueContents[0]}`);
      } else {
        mergedParts.push(uniqueContents[0]!);
      }
    } else {
      // Conflict
      conflicts.push({ heading: heading || "(preamble)", versions: uniqueContents });
      // Include first version with conflict marker
      if (heading) {
        mergedParts.push(
          `## ${heading}\n\n<!-- CONFLICT: ${uniqueContents.length} versions -->\n${uniqueContents[0]}`
        );
      } else {
        mergedParts.push(
          `<!-- CONFLICT: ${uniqueContents.length} versions -->\n${uniqueContents[0]}`
        );
      }
    }
  }

  return {
    merged: mergedParts.join("\n\n"),
    conflicts,
  };
}
