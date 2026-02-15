import { describe, it, expect, beforeEach } from "vitest";
import { FarmEngine } from "../src/engine.js";
import { EventBus } from "../src/event-bus.js";
import { registerAllRoles } from "../src/roles/index.js";
import { InMemoryAdapter } from "../src/testing/in-memory-adapter.js";
import {
  enforcePolicy,
  canPerform,
  PolicyViolationError,
} from "../src/policy-engine.js";

describe("Policy Enforcement", () => {
  beforeEach(() => {
    registerAllRoles();
  });

  // ── Field Hand constraints ──

  it("should allow Field Hand to submit artifacts", () => {
    expect(canPerform("submit_artifact", "FIELD_HAND")).toBe(true);
  });

  it("should prevent Field Hand from modifying canonical artifacts", () => {
    expect(canPerform("modify_canonical", "FIELD_HAND")).toBe(false);
    expect(() =>
      enforcePolicy("modify_canonical", "FIELD_HAND")
    ).toThrow(PolicyViolationError);
  });

  // ── Scout constraints ──

  it("should allow Scout to triage tasks", () => {
    expect(canPerform("triage_task", "FIELD_SCOUT")).toBe(true);
  });

  it("should prevent Scout from completing tasks", () => {
    expect(canPerform("complete_task", "FIELD_SCOUT")).toBe(false);
    expect(() =>
      enforcePolicy("complete_task", "FIELD_SCOUT")
    ).toThrow(PolicyViolationError);
  });

  it("should prevent Scout from submitting artifacts", () => {
    expect(canPerform("submit_artifact", "FIELD_SCOUT")).toBe(false);
  });

  // ── Bell Ringer constraints ──

  it("should allow Bell Ringer to trigger ticks", () => {
    expect(canPerform("trigger_tick", "BELL_RINGER")).toBe(true);
  });

  it("should prevent Bell Ringer from creating artifacts", () => {
    expect(canPerform("submit_artifact", "BELL_RINGER")).toBe(false);
    expect(canPerform("create_user_artifact", "BELL_RINGER")).toBe(false);
  });

  it("should prevent Bell Ringer from completing tasks", () => {
    expect(canPerform("complete_task", "BELL_RINGER")).toBe(false);
  });

  // ── Grain Elevator capabilities ──

  it("should allow Grain Elevator to modify canonical", () => {
    expect(canPerform("modify_canonical", "GRAIN_ELEVATOR")).toBe(true);
  });

  it("should allow Grain Elevator to canonicalize artifacts", () => {
    expect(canPerform("canonicalize_artifact", "GRAIN_ELEVATOR")).toBe(true);
  });

  // ── Farm Manager capabilities ──

  it("should allow Farm Manager to create work orders", () => {
    expect(canPerform("create_work_order", "FARM_MANAGER")).toBe(true);
  });

  it("should allow Farm Manager to assign tasks", () => {
    expect(canPerform("assign_task", "FARM_MANAGER")).toBe(true);
  });

  it("should allow Farm Manager to request merges", () => {
    expect(canPerform("request_merge", "FARM_MANAGER")).toBe(true);
  });

  // ── Barn Dog/Heel constraints ──

  it("should prevent Barn Dog from completing tasks", () => {
    expect(canPerform("complete_task", "BARN_DOG")).toBe(false);
  });

  it("should allow Heel to raise watchdog alerts", () => {
    expect(canPerform("watchdog_alert", "HEEL")).toBe(true);
  });

  // ── Engine-level enforcement ──

  it("should prevent Scout from completing tasks via engine", async () => {
    registerAllRoles();
    const eventBus = new EventBus();
    const adapter = new InMemoryAdapter();
    const engine = new FarmEngine(adapter, eventBus);

    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1");

    await engine.assignTask(task.id, "FIELD_HAND");
    await engine.updateTaskStatus(task.id, "IN_PROGRESS", "FIELD_HAND");

    // Scout should not be able to complete the task
    await expect(
      engine.updateTaskStatus(task.id, "DONE", "FIELD_SCOUT")
    ).rejects.toThrow("Policy violation");
  });

  // ── Unknown role ──

  it("should reject actions from unregistered roles", () => {
    expect(() =>
      enforcePolicy("assign_task", "UNKNOWN_ROLE" as never)
    ).toThrow(PolicyViolationError);
  });
});
