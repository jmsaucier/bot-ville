import { describe, it, expect, beforeEach } from "vitest";
import { FarmEngine } from "../src/engine.js";
import { EventBus } from "../src/event-bus.js";
import { registerAllRoles } from "../src/roles/index.js";
import { InMemoryAdapter } from "../src/testing/in-memory-adapter.js";
import type { FarmEvent } from "@repo/shared";

describe("Task Lifecycle", () => {
  let engine: FarmEngine;
  let eventBus: EventBus;
  let adapter: InMemoryAdapter;
  let emittedEvents: FarmEvent[];

  beforeEach(() => {
    registerAllRoles();
    eventBus = new EventBus();
    adapter = new InMemoryAdapter();
    engine = new FarmEngine(adapter, eventBus);
    emittedEvents = [];
    eventBus.onAny((event) => emittedEvents.push(event));
  });

  it("should create a work order with NEW status", async () => {
    const wo = await engine.createWorkOrder("Test goal");
    expect(wo.status).toBe("NEW");
    expect(wo.goal).toBe("Test goal");
    expect(wo.id).toBeDefined();

    const found = await adapter.getWorkOrder(wo.id);
    expect(found).not.toBeNull();
    expect(found!.goal).toBe("Test goal");
  });

  it("should create tasks under a work order", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1", "Description");

    expect(task.status).toBe("NEW");
    expect(task.workOrderId).toBe(wo.id);
    expect(task.title).toBe("Task 1");
  });

  it("should transition task through full lifecycle: NEW -> ASSIGNED -> IN_PROGRESS -> DONE", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1");

    // NEW -> ASSIGNED (via assignTask)
    const assigned = await engine.assignTask(task.id, "FIELD_HAND");
    expect(assigned.status).toBe("ASSIGNED");
    expect(assigned.ownerRole).toBe("FIELD_HAND");

    // ASSIGNED -> IN_PROGRESS
    const inProgress = await engine.updateTaskStatus(
      task.id,
      "IN_PROGRESS",
      "FIELD_HAND"
    );
    expect(inProgress.status).toBe("IN_PROGRESS");

    // IN_PROGRESS -> DONE
    const done = await engine.updateTaskStatus(
      task.id,
      "DONE",
      "FIELD_HAND"
    );
    expect(done.status).toBe("DONE");
  });

  it("should reject invalid status transitions", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1");

    // NEW -> DONE is not valid
    await expect(
      engine.updateTaskStatus(task.id, "DONE", "FIELD_HAND")
    ).rejects.toThrow("Invalid status transition");
  });

  it("should emit events for each lifecycle change", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1");

    emittedEvents = [];
    await engine.assignTask(task.id, "FIELD_HAND");

    const eventTypes = emittedEvents.map((e) => e.type);
    expect(eventTypes).toContain("task.assigned");
    expect(eventTypes).toContain("task.status_changed");
  });

  it("should handle task dependencies", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task1 = await engine.createTask(wo.id, "Task 1");
    const task2 = await engine.createTask(wo.id, "Task 2", "", [task1.id]);

    expect(task2.deps).toEqual([task1.id]);
  });

  it("should support BLOCKED -> ASSIGNED transition", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Task 1");

    await engine.assignTask(task.id, "FIELD_HAND");
    await engine.updateTaskStatus(task.id, "IN_PROGRESS", "FIELD_HAND");
    await engine.updateTaskStatus(task.id, "BLOCKED", "FIELD_HAND");

    const unblocked = await engine.updateTaskStatus(
      task.id,
      "ASSIGNED",
      "FIELD_SCOUT"
    );
    expect(unblocked.status).toBe("ASSIGNED");
  });

  it("should persist events in event log", async () => {
    const wo = await engine.createWorkOrder("Test");
    await engine.createTask(wo.id, "Task 1");

    const events = await adapter.queryEvents({ workOrderId: wo.id });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.action === "workorder.created")).toBe(true);
    expect(events.some((e) => e.action === "task.created")).toBe(true);
  });
});
