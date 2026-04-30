import { describe, it, expect, beforeEach } from "vitest";
import { FarmEngine } from "../src/engine.js";
import { EventBus } from "../src/event-bus.js";
import { registerAllRoles } from "../src/roles/index.js";
import { InMemoryAdapter } from "../src/testing/in-memory-adapter.js";
import { mergeTexts } from "../src/merge/text-merge.js";
import { mergeJsonObjects } from "../src/merge/json-merge.js";
import type { FarmEvent } from "@bot-ville/shared";

describe("Text Merge", () => {
  it("should merge non-conflicting sections", () => {
    const a = "## Intro\n\nHello world\n\n## Details\n\nSome details";
    const b = "## Intro\n\nHello world\n\n## Summary\n\nA summary";

    const result = mergeTexts([a, b]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toContain("Intro");
    expect(result.merged).toContain("Details");
    expect(result.merged).toContain("Summary");
  });

  it("should detect conflicting sections", () => {
    const a = "## Plan\n\nVersion A of the plan";
    const b = "## Plan\n\nVersion B of the plan";

    const result = mergeTexts([a, b]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.heading).toBe("Plan");
    expect(result.merged).toContain("CONFLICT");
  });

  it("should handle single source", () => {
    const result = mergeTexts(["## Only\n\nSingle source"]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toContain("Single source");
  });

  it("should handle empty sources", () => {
    const result = mergeTexts([]);
    expect(result.merged).toBe("");
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("JSON Merge", () => {
  it("should merge non-overlapping keys", () => {
    const a = { name: "Plan A", budget: 1000 };
    const b = { timeline: "2 weeks", team: "alpha" };

    const result = mergeJsonObjects([a, b]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({
      name: "Plan A",
      budget: 1000,
      timeline: "2 weeks",
      team: "alpha",
    });
  });

  it("should merge identical values without conflict", () => {
    const a = { name: "Plan", status: "active" };
    const b = { name: "Plan", priority: "high" };

    const result = mergeJsonObjects([a, b]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged["name"]).toBe("Plan");
  });

  it("should detect conflicting values", () => {
    const a = { budget: 1000, name: "A" };
    const b = { budget: 2000, name: "B" };

    const result = mergeJsonObjects([a, b]);
    expect(result.conflicts.length).toBeGreaterThan(0);
    const budgetConflict = result.conflicts.find((c) => c.path === "budget");
    expect(budgetConflict).toBeDefined();
  });

  it("should deep merge nested objects", () => {
    const a = { config: { port: 3000, host: "localhost" } };
    const b = { config: { port: 3000, debug: true } };

    const result = mergeJsonObjects([a, b]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged["config"]).toEqual({
      port: 3000,
      host: "localhost",
      debug: true,
    });
  });
});

describe("Merge Engine (Grain Elevator)", () => {
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

  it("should merge non-conflicting text drafts into canonical", async () => {
    const wo = await engine.createWorkOrder("Test merge");
    const task1 = await engine.createTask(wo.id, "Draft 1");
    const task2 = await engine.createTask(wo.id, "Draft 2");

    await engine.assignTask(task1.id, "FIELD_HAND");
    await engine.assignTask(task2.id, "FIELD_HAND");

    // Submit non-conflicting drafts
    await engine.submitArtifact(task1.id, "FIELD_HAND", {
      type: "plan",
      content: "## Overview\n\nThis is the overview",
      workOrderId: wo.id,
    });

    await engine.submitArtifact(task2.id, "FIELD_HAND", {
      type: "plan",
      content: "## Details\n\nThese are the details",
      workOrderId: wo.id,
    });

    const result = await engine.requestMerge(wo.id, "plan");
    expect(result.success).toBe(true);
    expect(result.canonicalArtifactId).not.toBeNull();
    expect(result.conflictReport).toBeNull();

    // Verify canonical artifact exists
    const artifacts = await adapter.listArtifacts(wo.id);
    const canonical = artifacts.find((a) => a.canonical);
    expect(canonical).toBeDefined();
    expect(canonical!.content).toContain("Overview");
    expect(canonical!.content).toContain("Details");
  });

  it("should report conflicts when text drafts conflict", async () => {
    const wo = await engine.createWorkOrder("Test conflict");
    const task1 = await engine.createTask(wo.id, "Draft 1");
    const task2 = await engine.createTask(wo.id, "Draft 2");

    await engine.assignTask(task1.id, "FIELD_HAND");
    await engine.assignTask(task2.id, "FIELD_HAND");

    // Submit conflicting drafts (same heading, different content)
    await engine.submitArtifact(task1.id, "FIELD_HAND", {
      type: "plan",
      content: "## Budget\n\n$1000 total budget",
      workOrderId: wo.id,
    });

    await engine.submitArtifact(task2.id, "FIELD_HAND", {
      type: "plan",
      content: "## Budget\n\n$2000 total budget",
      workOrderId: wo.id,
    });

    const result = await engine.requestMerge(wo.id, "plan");
    expect(result.success).toBe(false);
    expect(result.conflictReport).not.toBeNull();
    expect(result.conflictReport).toContain("Conflict");

    // Check that merge.conflict event was emitted
    const conflictEvents = emittedEvents.filter(
      (e) => e.type === "merge.conflict"
    );
    expect(conflictEvents.length).toBeGreaterThan(0);

    // Check that affected tasks are marked REVIEW
    const task1State = await adapter.getTask(task1.id);
    expect(task1State!.status).toBe("REVIEW");
  });

  it("should emit merge.completed on successful merge", async () => {
    const wo = await engine.createWorkOrder("Test");
    const task = await engine.createTask(wo.id, "Draft");
    await engine.assignTask(task.id, "FIELD_HAND");

    await engine.submitArtifact(task.id, "FIELD_HAND", {
      type: "doc",
      content: "## Section\n\nOnly one draft",
      workOrderId: wo.id,
    });

    emittedEvents = [];
    await engine.requestMerge(wo.id, "doc");

    const completedEvents = emittedEvents.filter(
      (e) => e.type === "merge.completed"
    );
    expect(completedEvents.length).toBe(1);
  });
});
