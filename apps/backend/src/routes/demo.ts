import type { FastifyInstance } from "fastify";
import type { FarmEngine } from "@bot-ville/core";

/**
 * Demo endpoint that runs the scripted end-to-end scenario.
 * POST /api/demo/run
 */
export function registerDemoRoute(
  app: FastifyInstance,
  engine: FarmEngine
): void {
  app.post("/api/demo/run", async (_request, reply) => {
    const log: string[] = [];
    const step = (msg: string) => {
      log.push(`[${new Date().toISOString()}] ${msg}`);
    };

    try {
      // 1. Create Work Order
      step("Creating work order: Design a small irrigation plan and bill of materials");
      const wo = await engine.createWorkOrder(
        "Design a small irrigation plan and bill of materials",
        { priority: "medium", domain: "agricultural-engineering" }
      );
      step(`Work order created: ${wo.id}`);

      // 2. Create tasks
      step("Creating tasks...");
      const researchTask = await engine.createTask(
        wo.id,
        "Research irrigation methods",
        "Research different irrigation approaches suitable for small farms"
      );
      step(`Task created: ${researchTask.title} (${researchTask.id})`);

      const planTask = await engine.createTask(
        wo.id,
        "Draft irrigation plan",
        "Create a detailed irrigation plan based on research findings",
        [researchTask.id]
      );
      step(`Task created: ${planTask.title} (${planTask.id})`);

      const bomTask = await engine.createTask(
        wo.id,
        "Draft bill of materials",
        "Create a bill of materials for the irrigation system",
        [researchTask.id]
      );
      step(`Task created: ${bomTask.title} (${bomTask.id})`);

      const reviewTask = await engine.createTask(
        wo.id,
        "Review and finalize",
        "Review all drafts and merge into final deliverables",
        [planTask.id, bomTask.id]
      );
      step(`Task created: ${reviewTask.title} (${reviewTask.id})`);

      // 3. Assign tasks to Field Hands
      step("Assigning tasks to Field Hands...");
      await engine.assignTask(researchTask.id, "FIELD_HAND");
      step(`Assigned: ${researchTask.title} -> FIELD_HAND`);

      // 4. Progress the research task
      step("Field Hand starts research...");
      await engine.updateTaskStatus(
        researchTask.id,
        "IN_PROGRESS",
        "FIELD_HAND"
      );

      // Simulate a block on the plan task
      step("Assigning plan task...");
      await engine.assignTask(planTask.id, "FIELD_HAND");
      await engine.updateTaskStatus(
        planTask.id,
        "IN_PROGRESS",
        "FIELD_HAND"
      );
      step("Plan task becomes BLOCKED (missing soil data)...");
      await engine.updateTaskStatus(
        planTask.id,
        "BLOCKED",
        "FIELD_HAND",
        "Missing soil composition data - cannot determine pipe sizing"
      );

      // 5. Complete research and submit artifact
      step("Research complete, submitting artifact...");
      await engine.updateTaskStatus(
        researchTask.id,
        "DONE",
        "FIELD_HAND"
      );
      await engine.submitArtifact(researchTask.id, "FIELD_HAND", {
        type: "irrigation_plan",
        content: [
          "## Research Findings",
          "",
          "### Drip Irrigation",
          "Most water-efficient method. Suitable for small farms.",
          "Requires pressure regulator and filter system.",
          "",
          "### Sprinkler Systems",
          "Good coverage but higher water usage.",
          "Better for larger open areas.",
          "",
          "### Recommendation",
          "Drip irrigation with zone control for optimal efficiency.",
        ].join("\n"),
        workOrderId: wo.id,
      });

      // 6. Run tick - Scout should triage the blocked task
      step("Running tick (Scout triage + Bell Ringer cadence)...");
      const tickResult = await engine.tick();
      step(
        `Tick result: ${tickResult.scout.triaged} triaged, ${tickResult.scout.unblocked} unblocked`
      );

      // If scout didn't auto-unblock (deps not met), manually unblock via scout
      const planAfterTick = (
        await engine.getSnapshot(wo.id)
      ).tasks.find((t) => t.id === planTask.id);

      if (planAfterTick?.status === "BLOCKED") {
        step("Scout manually triaging blocked task...");
        await engine.updateTaskStatus(
          planTask.id,
          "ASSIGNED",
          "FIELD_SCOUT",
          "Scout: provided default soil data assumptions to unblock"
        );
        await engine.recordDecision(
          wo.id,
          "FIELD_SCOUT",
          "Used default soil composition assumptions",
          "Missing soil data was blocking the plan draft. Used standard loam assumptions to unblock progress.",
          planTask.id
        );
      }

      // 7. Progress plan and BOM tasks
      step("Progressing plan and BOM tasks...");
      await engine.updateTaskStatus(
        planTask.id,
        "IN_PROGRESS",
        "FIELD_HAND"
      );
      await engine.assignTask(bomTask.id, "FIELD_HAND");
      await engine.updateTaskStatus(
        bomTask.id,
        "IN_PROGRESS",
        "FIELD_HAND"
      );

      // Submit plan draft
      step("Submitting plan draft artifact...");
      await engine.submitArtifact(planTask.id, "FIELD_HAND", {
        type: "irrigation_plan",
        content: [
          "## Irrigation Plan",
          "",
          "### Zone Layout",
          "- Zone A: Vegetable garden (drip lines, 0.5 GPH emitters)",
          "- Zone B: Herb garden (micro-sprinklers)",
          "- Zone C: Fruit trees (drip rings, 2 GPH emitters)",
          "",
          "### Water Source",
          "Main supply from well pump, 15 GPM capacity.",
          "Install pressure regulator at 25 PSI.",
          "",
          "### Schedule",
          "Zones A+B: 30 min, 3x/week",
          "Zone C: 60 min, 2x/week",
        ].join("\n"),
        workOrderId: wo.id,
      });

      await engine.updateTaskStatus(planTask.id, "DONE", "FIELD_HAND");

      // Submit BOM draft
      step("Submitting BOM draft artifact...");
      await engine.submitArtifact(bomTask.id, "FIELD_HAND", {
        type: "irrigation_plan",
        content: [
          "## Bill of Materials",
          "",
          "### Pipes and Fittings",
          "- 200ft 1/2\" polyethylene tubing",
          "- 50ft 1/4\" drip line",
          "- 20x barbed connectors",
          "- 10x end caps",
          "",
          "### Emitters",
          "- 30x 0.5 GPH drip emitters",
          "- 10x 2 GPH drip emitters",
          "- 5x micro-sprinkler heads",
          "",
          "### Controls",
          "- 1x 3-zone timer controller",
          "- 3x solenoid valves (3/4\")",
          "- 1x pressure regulator (25 PSI)",
          "- 1x Y-filter (120 mesh)",
        ].join("\n"),
        workOrderId: wo.id,
      });

      await engine.updateTaskStatus(bomTask.id, "DONE", "FIELD_HAND");

      // 8. Grain Elevator merge
      step("Requesting merge via Grain Elevator...");
      const mergeResult = await engine.requestMerge(
        wo.id,
        "irrigation_plan"
      );
      step(
        `Merge result: success=${mergeResult.success}, canonical=${mergeResult.canonicalArtifactId}`
      );

      // 9. Complete review task
      step("Completing review task...");
      await engine.assignTask(reviewTask.id, "FARM_MANAGER");
      await engine.updateTaskStatus(
        reviewTask.id,
        "IN_PROGRESS",
        "FARM_MANAGER"
      );
      await engine.updateTaskStatus(
        reviewTask.id,
        "DONE",
        "FARM_MANAGER"
      );

      // Record final decision
      await engine.recordDecision(
        wo.id,
        "FARM_MANAGER",
        "Irrigation plan approved",
        "All drafts merged successfully. Plan and BOM are consistent and ready for implementation.",
        reviewTask.id
      );

      // Get final snapshot
      const snapshot = await engine.getSnapshot(wo.id);
      step("Demo complete!");

      return reply.send({
        success: true,
        log,
        summary: {
          workOrderId: wo.id,
          totalTasks: snapshot.tasks.length,
          completedTasks: snapshot.tasks.filter((t) => t.status === "DONE")
            .length,
          totalArtifacts: snapshot.artifacts.length,
          canonicalArtifacts: snapshot.artifacts.filter((a) => a.canonical)
            .length,
          totalEvents: snapshot.events.length,
          totalDecisions: snapshot.decisions.length,
          mergeSuccess: mergeResult.success,
        },
      });
    } catch (error) {
      step(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
      return reply.status(500).send({
        success: false,
        log,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
