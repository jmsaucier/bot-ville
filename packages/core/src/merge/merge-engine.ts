import type { Artifact, EventLog, FarmEvent } from "@bot-ville/shared";
import type { PersistenceAdapter } from "../persistence.js";
import type { EventBus } from "../event-bus.js";
import { mergeTexts } from "./text-merge.js";
import { mergeJsonStrings, type JsonConflict } from "./json-merge.js";

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export interface MergeResult {
  success: boolean;
  canonicalArtifactId: string | null;
  conflictReport: string | null;
  affectedTaskIds: string[];
}

/**
 * Grain Elevator merge engine.
 * Merges draft artifacts into a single canonical artifact.
 */
export class MergeEngine {
  constructor(
    private readonly persistence: PersistenceAdapter,
    private readonly eventBus: EventBus
  ) {}

  private async emitAndPersist(
    event: FarmEvent,
    role: string,
    workOrderId: string | null = null
  ): Promise<void> {
    const logEntry: EventLog = {
      id: uuid(),
      timestamp: now(),
      role: role as EventLog["role"],
      action: event.type,
      payload: event.payload as Record<string, unknown>,
      correlationId: null,
      workOrderId,
    };
    await this.persistence.createEventLog(logEntry);
    this.eventBus.emit(event);
  }

  async merge(
    workOrderId: string,
    artifactType: string
  ): Promise<MergeResult> {
    // Get all draft artifacts of this type for the work order
    const allArtifacts = await this.persistence.listArtifactsByType(
      workOrderId,
      artifactType
    );

    const drafts = allArtifacts.filter((a) => !a.canonical);

    if (drafts.length === 0) {
      return {
        success: false,
        canonicalArtifactId: null,
        conflictReport: "No draft artifacts found to merge.",
        affectedTaskIds: [],
      };
    }

    // Emit merge requested event
    await this.emitAndPersist(
      {
        type: "merge.requested",
        payload: {
          workOrderId,
          artifactType,
          artifactIds: drafts.map((d) => d.id),
        },
      },
      "GRAIN_ELEVATOR",
      workOrderId
    );

    // Determine merge strategy based on content type
    const isJson = this.looksLikeJson(drafts);
    const mergeResult = isJson
      ? this.mergeAsJson(drafts)
      : this.mergeAsText(drafts);

    const affectedTaskIds = drafts
      .map((d) => d.linkedTaskId)
      .filter((id): id is string => id !== null);

    if (mergeResult.conflicts.length > 0) {
      // Conflicts detected
      const conflictReport = this.formatConflictReport(
        mergeResult.conflicts,
        artifactType
      );

      // Create conflict report artifact
      await this.persistence.createArtifact({
        id: uuid(),
        type: `${artifactType}_conflict_report`,
        content: conflictReport,
        createdByRole: "GRAIN_ELEVATOR",
        linkedTaskId: null,
        workOrderId,
        version: 1,
        canonical: false,
        createdAt: now(),
        updatedAt: now(),
      });

      // Mark affected tasks as REVIEW
      for (const taskId of affectedTaskIds) {
        const task = await this.persistence.getTask(taskId);
        if (task && task.status !== "REVIEW") {
          await this.persistence.updateTask(taskId, {
            status: "REVIEW",
            updatedAt: now(),
          });
        }
      }

      // Emit conflict event
      await this.emitAndPersist(
        {
          type: "merge.conflict",
          payload: {
            workOrderId,
            artifactType,
            conflictReport,
            affectedTaskIds,
          },
        },
        "GRAIN_ELEVATOR",
        workOrderId
      );

      return {
        success: false,
        canonicalArtifactId: null,
        conflictReport,
        affectedTaskIds,
      };
    }

    // No conflicts -- create canonical artifact
    const canonicalArtifact: Artifact = {
      id: uuid(),
      type: artifactType,
      content: mergeResult.mergedContent,
      createdByRole: "GRAIN_ELEVATOR",
      linkedTaskId: null,
      workOrderId,
      version: 1,
      canonical: true,
      createdAt: now(),
      updatedAt: now(),
    };

    const created =
      await this.persistence.createArtifact(canonicalArtifact);

    // Emit canonicalized event
    await this.emitAndPersist(
      {
        type: "artifact.canonicalized",
        payload: {
          artifactId: created.id,
          workOrderId,
          type: artifactType,
        },
      },
      "GRAIN_ELEVATOR",
      workOrderId
    );

    // Emit merge completed event
    await this.emitAndPersist(
      {
        type: "merge.completed",
        payload: {
          workOrderId,
          artifactType,
          canonicalArtifactId: created.id,
        },
      },
      "GRAIN_ELEVATOR",
      workOrderId
    );

    return {
      success: true,
      canonicalArtifactId: created.id,
      conflictReport: null,
      affectedTaskIds,
    };
  }

  private looksLikeJson(artifacts: Artifact[]): boolean {
    return artifacts.every((a) => {
      try {
        JSON.parse(a.content);
        return true;
      } catch {
        return false;
      }
    });
  }

  private mergeAsText(artifacts: Artifact[]): {
    mergedContent: string;
    conflicts: { description: string }[];
  } {
    const result = mergeTexts(artifacts.map((a) => a.content));
    return {
      mergedContent: result.merged,
      conflicts: result.conflicts.map((c) => ({
        description: `Section "${c.heading}": ${c.versions.length} conflicting versions`,
      })),
    };
  }

  private mergeAsJson(artifacts: Artifact[]): {
    mergedContent: string;
    conflicts: { description: string }[];
  } {
    const result = mergeJsonStrings(artifacts.map((a) => a.content));
    return {
      mergedContent: result.merged,
      conflicts: result.conflicts.map((c: JsonConflict) => ({
        description: `Key "${c.path}": ${c.values.length} conflicting values`,
      })),
    };
  }

  private formatConflictReport(
    conflicts: { description: string }[],
    artifactType: string
  ): string {
    const lines = [
      `# Merge Conflict Report: ${artifactType}`,
      "",
      `Generated: ${now()}`,
      "",
      `## Conflicts (${conflicts.length})`,
      "",
    ];

    for (let i = 0; i < conflicts.length; i++) {
      lines.push(`${i + 1}. ${conflicts[i]!.description}`);
    }

    lines.push("");
    lines.push(
      "## Resolution Required",
      "",
      "Please resolve the above conflicts and re-submit the artifacts for merging."
    );

    return lines.join("\n");
  }
}
