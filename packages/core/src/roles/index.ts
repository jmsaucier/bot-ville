import { registerRole, type RoleDefinition } from "../policy-engine.js";
import { farmManager } from "./farm-manager.js";
import { fieldHand } from "./field-hand.js";
import { fieldScout } from "./field-scout.js";
import { grainElevator } from "./grain-elevator.js";
import { bellRinger } from "./bell-ringer.js";
import { barnDog } from "./barn-dog.js";
import { heel } from "./heel.js";
import { barnCrew } from "./barn-crew.js";

export const ALL_ROLES: RoleDefinition[] = [
  farmManager,
  fieldHand,
  fieldScout,
  grainElevator,
  bellRinger,
  barnDog,
  heel,
  barnCrew,
];

/**
 * Register all farm roles in the policy engine.
 * Must be called once during system initialization.
 */
export function registerAllRoles(): void {
  for (const role of ALL_ROLES) {
    registerRole(role);
  }
}

export {
  farmManager,
  fieldHand,
  fieldScout,
  grainElevator,
  bellRinger,
  barnDog,
  heel,
  barnCrew,
};
