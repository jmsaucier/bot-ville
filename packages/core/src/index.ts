// Engine
export { FarmEngine, type TickResult } from "./engine.js";

// Event Bus
export { EventBus } from "./event-bus.js";

// Persistence
export type { PersistenceAdapter, EventFilters } from "./persistence.js";

// Policy Engine
export {
  enforcePolicy,
  canPerform,
  registerRole,
  getRole,
  getAllRoles,
  PolicyViolationError,
  type ActionType,
  type Policy,
  type RoleDefinition,
} from "./policy-engine.js";

// Roles
export {
  registerAllRoles,
  ALL_ROLES,
  farmManager,
  fieldHand,
  fieldScout,
  grainElevator,
  bellRinger,
  barnDog,
  heel,
  barnCrew,
} from "./roles/index.js";

// Merge
export { MergeEngine, type MergeResult } from "./merge/merge-engine.js";
export { GitMergeEngine, type GitMergeResult } from "./merge/git-merge.js";
export { mergeTexts, parseSections } from "./merge/text-merge.js";
export { mergeJsonObjects, mergeJsonStrings } from "./merge/json-merge.js";

// Agents
export {
  AgentRegistry,
  AgentSpawner,
  WorktreeManager,
  InstructionGenerator,
  type SpawnOptions,
  type WorktreeConfig,
  type WorktreeOptions,
  type WorktreeInfo,
  type InstructionContext,
} from "./agents/index.js";

// Testing
export { InMemoryAdapter } from "./testing/in-memory-adapter.js";
