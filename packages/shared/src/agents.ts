import { z } from "zod";
import { RoleIdEnum } from "./roles.js";

// ─── Agent Preset ───────────────────────────────────────────────────────────

export const PromptModeEnum = z.enum(["arg", "none"]);
export type PromptMode = z.infer<typeof PromptModeEnum>;

export const ResumeStyleEnum = z.enum(["flag", "subcommand"]);
export type ResumeStyle = z.infer<typeof ResumeStyleEnum>;

export const AgentPresetSchema = z.object({
  /** Unique identifier for the preset (e.g. "cursor", "claude") */
  id: z.string().min(1),
  /** Human-readable display name */
  name: z.string().min(1),
  /** CLI command to invoke (e.g. "cursor-agent", "claude") */
  command: z.string().min(1),
  /** Default command-line arguments for autonomous mode */
  args: z.array(z.string()).default([]),
  /** Environment variables to set when starting the agent */
  env: z.record(z.string()).default({}),
  /** Process names for detecting if the agent is running */
  processNames: z.array(z.string()).default([]),
  /** How prompts are passed to the runtime */
  promptMode: PromptModeEnum.default("arg"),
  /** Environment variable that holds the session ID */
  sessionIdEnv: z.string().default(""),
  /** Flag or subcommand for resuming sessions */
  resumeFlag: z.string().default(""),
  /** How the resume flag is applied */
  resumeStyle: ResumeStyleEnum.default("flag"),
  /** Whether the agent supports hooks (e.g. .claude/settings.json) */
  supportsHooks: z.boolean().default(false),
  /** The role instruction filename this agent reads */
  instructionsFile: z.string().default("AGENTS.md"),
  /** Non-interactive execution config (for headless/script usage) */
  nonInteractive: z
    .object({
      subcommand: z.string().optional(),
      promptFlag: z.string().optional(),
      outputFlag: z.string().optional(),
    })
    .optional(),
});

export type AgentPreset = z.infer<typeof AgentPresetSchema>;

// ─── Agent Session ──────────────────────────────────────────────────────────

export const AgentSessionStatusEnum = z.enum([
  "spawning",
  "running",
  "paused",
  "completed",
  "failed",
  "killed",
]);
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusEnum>;

export const AgentSessionSchema = z.object({
  /** Unique session ID */
  id: z.string().uuid(),
  /** Which agent preset is being used */
  agentPresetId: z.string().min(1),
  /** The farm role this agent is operating as */
  roleId: RoleIdEnum,
  /** The work order this agent is working on */
  workOrderId: z.string().uuid().nullable().default(null),
  /** The specific task assigned to this agent */
  taskId: z.string().uuid().nullable().default(null),
  /** Current status of the agent session */
  status: AgentSessionStatusEnum,
  /** OS process ID (if spawned) */
  pid: z.number().int().nullable().default(null),
  /** Working directory for this agent session */
  workingDirectory: z.string().nullable().default(null),
  /** Agent-specific session ID (e.g. CLAUDE_SESSION_ID) */
  agentSessionId: z.string().nullable().default(null),
  /** Last heartbeat timestamp */
  lastHeartbeat: z.string().datetime().nullable().default(null),
  /** When the session was spawned */
  spawnedAt: z.string().datetime(),
  /** When the session completed (if applicable) */
  completedAt: z.string().datetime().nullable().default(null),
});

export type AgentSession = z.infer<typeof AgentSessionSchema>;

// ─── Agent Config (per-session runtime config) ─────────────────────────────

export const AgentConfigSchema = z.object({
  /** Agent provider identifier */
  provider: z.string().min(1),
  /** CLI command to invoke */
  command: z.string().min(1),
  /** Command-line arguments */
  args: z.array(z.string()).default([]),
  /** Environment variables */
  env: z.record(z.string()).default({}),
  /** Initial prompt to send on startup */
  initialPrompt: z.string().default(""),
  /** How prompts are passed */
  promptMode: PromptModeEnum.default("arg"),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// ─── Mail Message ───────────────────────────────────────────────────────────

export const AgentMailSchema = z.object({
  id: z.string().uuid(),
  /** Sender session ID or role */
  from: z.string().min(1),
  /** Recipient session ID or role */
  to: z.string().min(1),
  /** Message subject */
  subject: z.string().min(1),
  /** Message body */
  body: z.string().default(""),
  /** When the message was sent */
  sentAt: z.string().datetime(),
  /** When the message was read (null if unread) */
  readAt: z.string().datetime().nullable().default(null),
});

export type AgentMail = z.infer<typeof AgentMailSchema>;

// ─── API Schemas for Agent Routes ───────────────────────────────────────────

export const SpawnAgentRequest = z.object({
  agentPresetId: z.string().min(1).default("cursor"),
  roleId: RoleIdEnum,
  workOrderId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  initialPrompt: z.string().optional(),
  workingDirectory: z.string().optional(),
});
export type SpawnAgentRequestType = z.infer<typeof SpawnAgentRequest>;

export const AgentHeartbeatRequest = z.object({
  message: z.string().optional(),
});
export type AgentHeartbeatRequestType = z.infer<typeof AgentHeartbeatRequest>;

export const AgentDoneRequest = z.object({
  message: z.string().optional(),
  artifactContent: z.string().optional(),
  artifactType: z.string().optional(),
});
export type AgentDoneRequestType = z.infer<typeof AgentDoneRequest>;

export const SendMailRequest = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().default(""),
});
export type SendMailRequestType = z.infer<typeof SendMailRequest>;

export const AgentSessionResponse = AgentSessionSchema;
export type AgentSessionResponseType = z.infer<typeof AgentSessionResponse>;

export const AgentSessionListResponse = z.array(AgentSessionSchema);
export type AgentSessionListResponseType = z.infer<
  typeof AgentSessionListResponse
>;

export const AgentMailListResponse = z.array(AgentMailSchema);
export type AgentMailListResponseType = z.infer<typeof AgentMailListResponse>;
