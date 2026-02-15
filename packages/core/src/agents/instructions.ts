import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import {
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  type RoleId,
  type Task,
  type WorkOrder,
} from "@repo/shared";
import { getRole, type RoleDefinition } from "../policy-engine.js";

export interface InstructionContext {
  /** The role this agent is operating as */
  roleId: RoleId;
  /** The work order (if assigned) */
  workOrder?: WorkOrder;
  /** The specific task (if assigned) */
  task?: Task;
  /** The session ID */
  sessionId: string;
  /** URL of the backend API */
  apiUrl: string;
}

/**
 * Generates role-specific instruction files for agent working directories.
 *
 * Different agent CLIs read different files:
 * - Claude Code reads CLAUDE.md
 * - Most others read AGENTS.md
 *
 * This generator creates the appropriate file with:
 * - Role description and responsibilities
 * - Policy rules (what the agent can and cannot do)
 * - Current task context
 * - Available bv CLI commands
 */
export class InstructionGenerator {
  /**
   * Generate and write instruction files to the target directory.
   * Creates both AGENTS.md and CLAUDE.md with the same content.
   */
  async writeInstructions(
    targetDir: string,
    context: InstructionContext
  ): Promise<void> {
    const content = this.generate(context);

    await mkdir(targetDir, { recursive: true });

    // Write both AGENTS.md and CLAUDE.md so any agent CLI can find instructions
    await Promise.all([
      writeFile(join(targetDir, "AGENTS.md"), content, "utf-8"),
      writeFile(join(targetDir, "CLAUDE.md"), content, "utf-8"),
    ]);
  }

  /**
   * Generate instruction content as a string.
   */
  generate(context: InstructionContext): string {
    const { roleId, workOrder, task, sessionId, apiUrl } = context;
    const roleName = ROLE_DISPLAY_NAMES[roleId];
    const roleDescription = ROLE_DESCRIPTIONS[roleId];
    const roleDefinition = getRole(roleId);

    const sections: string[] = [];

    // Header
    sections.push(`# bot-ville Agent Instructions`);
    sections.push("");
    sections.push(
      `You are operating as a **${roleName}** in the bot-ville farm orchestration system.`
    );
    sections.push("");

    // Role
    sections.push(`## Your Role: ${roleName}`);
    sections.push("");
    sections.push(roleDescription);
    sections.push("");

    // Policies
    if (roleDefinition) {
      sections.push(`## Policies`);
      sections.push("");
      sections.push(this.formatPolicies(roleDefinition));
      sections.push("");
    }

    // Current assignment
    if (workOrder || task) {
      sections.push(`## Current Assignment`);
      sections.push("");

      if (workOrder) {
        sections.push(`**Work Order:** ${workOrder.goal}`);
        sections.push(`- ID: \`${workOrder.id}\``);
        sections.push(`- Status: ${workOrder.status}`);
        sections.push("");
      }

      if (task) {
        sections.push(`**Task:** ${task.title}`);
        sections.push(`- ID: \`${task.id}\``);
        sections.push(`- Status: ${task.status}`);
        if (task.description) {
          sections.push(`- Description: ${task.description}`);
        }
        sections.push("");
      }
    }

    // bv CLI commands
    sections.push(`## Available Commands`);
    sections.push("");
    sections.push(
      `Use the \`bv\` CLI to interact with bot-ville. ` +
        `The following environment variables are pre-configured:`
    );
    sections.push("");
    sections.push(`- \`BV_API_URL\` = \`${apiUrl}\``);
    sections.push(`- \`BV_SESSION_ID\` = \`${sessionId}\``);
    sections.push(`- \`BV_ROLE\` = \`${roleId}\``);
    if (workOrder) {
      sections.push(`- \`BV_WORK_ORDER_ID\` = \`${workOrder.id}\``);
    }
    if (task) {
      sections.push(`- \`BV_TASK_ID\` = \`${task.id}\``);
    }
    sections.push("");
    sections.push(`### Commands`);
    sections.push("");
    sections.push(`| Command | Description |`);
    sections.push(`|---|---|`);
    sections.push(
      `| \`bv prime\` | Display your current context (role, task, work order) |`
    );
    sections.push(
      `| \`bv status [message]\` | Report a status update / heartbeat |`
    );
    sections.push(
      `| \`bv done [--message "..."]\` | Signal that your task is complete |`
    );
    sections.push(
      `| \`bv artifact submit <file>\` | Submit a file as a draft artifact |`
    );
    sections.push(
      `| \`bv tasks\` | List all tasks in your work order |`
    );
    sections.push(
      `| \`bv events [--follow]\` | View or stream events |`
    );
    sections.push(
      `| \`bv mail send <role> <message>\` | Send a message to another agent |`
    );
    sections.push(`| \`bv mail check\` | Check for incoming messages |`);
    sections.push(`| \`bv config\` | Show your current session configuration |`);
    sections.push("");

    // Guidelines
    sections.push(`## Guidelines`);
    sections.push("");
    sections.push(`1. **Stay in role.** Only perform actions allowed by your policies.`);
    sections.push(
      `2. **Report progress.** Use \`bv status\` periodically so the system can track your work.`
    );
    sections.push(
      `3. **Signal completion.** When your task is done, run \`bv done\` with a summary message.`
    );
    sections.push(
      `4. **Submit artifacts.** If your work produces output files, submit them with \`bv artifact submit\`.`
    );
    sections.push(
      `5. **Ask for help.** If you're blocked, use \`bv mail send FARM_MANAGER "I need help with..."\`.`
    );
    sections.push("");

    return sections.join("\n");
  }

  private formatPolicies(role: RoleDefinition): string {
    const lines: string[] = [];

    lines.push(`**Capabilities:**`);
    lines.push(`- Can modify canonical artifacts: ${role.canModifyCanonical ? "Yes" : "No"}`);
    lines.push(`- Can complete tasks: ${role.canCompleteTasks ? "Yes" : "No"}`);
    lines.push(`- Can create artifacts: ${role.canCreateArtifacts ? "Yes" : "No"}`);
    lines.push("");

    if (role.policies.length > 0) {
      lines.push(`**Action Policies:**`);
      for (const policy of role.policies) {
        const status = policy.allowed ? "ALLOWED" : "DENIED";
        const reason = policy.reason ? ` -- ${policy.reason}` : "";
        lines.push(`- \`${policy.action}\`: ${status}${reason}`);
      }
    }

    return lines.join("\n");
  }
}
