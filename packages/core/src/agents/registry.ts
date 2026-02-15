import type { AgentPreset } from "@repo/shared";
import { AgentPresetSchema } from "@repo/shared";
import { readFile } from "node:fs/promises";

/**
 * Built-in agent presets. These provide sensible defaults for popular agent CLIs.
 * Custom agents can be registered at runtime or loaded from `.bot-ville/agents.json`.
 */
const BUILTIN_PRESETS: AgentPreset[] = [
  {
    id: "cursor",
    name: "Cursor Agent",
    command: "cursor-agent",
    args: ["-f"],
    env: {},
    processNames: ["cursor-agent"],
    promptMode: "arg",
    sessionIdEnv: "",
    resumeFlag: "--resume",
    resumeStyle: "flag",
    supportsHooks: false,
    instructionsFile: "AGENTS.md",
    nonInteractive: {
      promptFlag: "-p",
      outputFlag: "--output-format json",
    },
  },
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    args: ["--dangerously-skip-permissions"],
    env: {},
    processNames: ["node", "claude"],
    promptMode: "arg",
    sessionIdEnv: "CLAUDE_SESSION_ID",
    resumeFlag: "--resume",
    resumeStyle: "flag",
    supportsHooks: true,
    instructionsFile: "CLAUDE.md",
  },
  {
    id: "codex",
    name: "OpenAI Codex",
    command: "codex",
    args: ["--yolo"],
    env: {},
    processNames: ["codex"],
    promptMode: "none",
    sessionIdEnv: "",
    resumeFlag: "resume",
    resumeStyle: "subcommand",
    supportsHooks: false,
    instructionsFile: "AGENTS.md",
    nonInteractive: {
      subcommand: "exec",
      outputFlag: "--json",
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    args: ["--approval-mode", "yolo"],
    env: {},
    processNames: ["gemini"],
    promptMode: "arg",
    sessionIdEnv: "GEMINI_SESSION_ID",
    resumeFlag: "--resume",
    resumeStyle: "flag",
    supportsHooks: true,
    instructionsFile: "AGENTS.md",
    nonInteractive: {
      promptFlag: "-p",
      outputFlag: "--output-format json",
    },
  },
  {
    id: "amp",
    name: "Sourcegraph Amp",
    command: "amp",
    args: ["--dangerously-allow-all", "--no-ide"],
    env: {},
    processNames: ["amp"],
    promptMode: "arg",
    sessionIdEnv: "",
    resumeFlag: "threads continue",
    resumeStyle: "subcommand",
    supportsHooks: false,
    instructionsFile: "AGENTS.md",
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    args: [],
    env: { OPENCODE_PERMISSION: '{"*":"allow"}' },
    processNames: ["opencode", "node", "bun"],
    promptMode: "none",
    sessionIdEnv: "",
    resumeFlag: "",
    resumeStyle: "flag",
    supportsHooks: true,
    instructionsFile: "AGENTS.md",
    nonInteractive: {
      subcommand: "run",
      outputFlag: "--format json",
    },
  },
];

/**
 * Registry for agent presets. Provides built-in presets and allows
 * registering custom agents at runtime or from config files.
 */
export class AgentRegistry {
  private presets = new Map<string, AgentPreset>();

  constructor() {
    // Load built-in presets
    for (const preset of BUILTIN_PRESETS) {
      this.presets.set(preset.id, preset);
    }
  }

  /** Get a preset by ID. Returns undefined if not found. */
  getPreset(id: string): AgentPreset | undefined {
    return this.presets.get(id);
  }

  /** Get a preset by ID, throwing if not found. */
  getPresetOrThrow(id: string): AgentPreset {
    const preset = this.presets.get(id);
    if (!preset) {
      throw new Error(
        `Unknown agent preset "${id}". Available: ${this.listPresetIds().join(", ")}`
      );
    }
    return preset;
  }

  /** List all registered preset IDs. */
  listPresetIds(): string[] {
    return Array.from(this.presets.keys());
  }

  /** List all registered presets. */
  listPresets(): AgentPreset[] {
    return Array.from(this.presets.values());
  }

  /** Register a custom agent preset. Overwrites if ID already exists. */
  registerPreset(preset: AgentPreset): void {
    const validated = AgentPresetSchema.parse(preset);
    this.presets.set(validated.id, validated);
  }

  /**
   * Load custom presets from a JSON config file.
   * File format: { "agents": [ { ...AgentPreset }, ... ] }
   * Silently returns if the file does not exist.
   */
  async loadFromFile(filePath: string): Promise<void> {
    let data: string;
    try {
      data = await readFile(filePath, "utf-8");
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return; // File doesn't exist, that's fine
      }
      throw err;
    }

    const parsed = JSON.parse(data) as { agents?: unknown[] };
    if (!parsed.agents || !Array.isArray(parsed.agents)) {
      return;
    }

    for (const raw of parsed.agents) {
      const preset = AgentPresetSchema.parse(raw);
      this.presets.set(preset.id, preset);
    }
  }

  /**
   * Build a full CLI command string for an agent preset.
   * Optionally includes a prompt as a positional argument.
   */
  buildCommand(presetId: string, prompt?: string): string {
    const preset = this.getPresetOrThrow(presetId);
    const parts = [preset.command, ...preset.args];

    if (prompt && preset.promptMode !== "none") {
      if (preset.nonInteractive?.promptFlag) {
        parts.push(preset.nonInteractive.promptFlag, quoteForShell(prompt));
      } else {
        parts.push(quoteForShell(prompt));
      }
    }

    return parts.join(" ");
  }

  /**
   * Build a CLI command for resuming an existing session.
   * Returns null if the preset doesn't support resume or no sessionId is given.
   */
  buildResumeCommand(presetId: string, sessionId: string): string | null {
    if (!sessionId) return null;

    const preset = this.getPresetOrThrow(presetId);
    if (!preset.resumeFlag) return null;

    if (preset.resumeStyle === "subcommand") {
      // e.g. "codex resume <id> --yolo"
      return [preset.command, preset.resumeFlag, sessionId, ...preset.args]
        .filter(Boolean)
        .join(" ");
    }

    // Default: flag style, e.g. "claude --dangerously-skip-permissions --resume <id>"
    return [preset.command, ...preset.args, preset.resumeFlag, sessionId].join(
      " "
    );
  }

  /** Get the default agent preset ID. */
  getDefaultPresetId(): string {
    return "cursor";
  }
}

/** Quote a string for safe shell usage. */
function quoteForShell(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
  return `"${escaped}"`;
}
