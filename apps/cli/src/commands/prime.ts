import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const primeCommand = new Command("prime")
  .description("Display current context (role, task, work order). Context recovery command.")
  .action(async () => {
    const ctx = getSessionContext();

    console.log("=== bot-ville Agent Context ===\n");
    console.log(`Session ID:   ${ctx.sessionId}`);
    console.log(`Role:         ${ctx.role ?? "unknown"}`);
    console.log(`Agent:        ${ctx.agentPreset ?? "unknown"}`);
    console.log(`API URL:      ${ctx.apiUrl}`);

    if (ctx.workOrderId) {
      console.log(`Work Order:   ${ctx.workOrderId}`);
      try {
        const snapshot = (await api.getSnapshot(ctx.workOrderId)) as {
          workOrder: { goal: string; status: string };
          tasks: { id: string; title: string; status: string; ownerRole: string | null }[];
        };
        console.log(`  Goal:       ${snapshot.workOrder.goal}`);
        console.log(`  Status:     ${snapshot.workOrder.status}`);
        console.log(`  Tasks:      ${snapshot.tasks.length}`);

        if (snapshot.tasks.length > 0) {
          console.log("\n--- Tasks ---");
          for (const task of snapshot.tasks) {
            const owner = task.ownerRole ? ` [${task.ownerRole}]` : "";
            console.log(`  ${task.status.padEnd(12)} ${task.title}${owner}  (${task.id.slice(0, 8)})`);
          }
        }
      } catch (err) {
        console.log(`  (could not fetch work order details: ${err instanceof Error ? err.message : err})`);
      }
    }

    if (ctx.taskId) {
      console.log(`\nAssigned Task: ${ctx.taskId}`);
    }

    // Heartbeat to let the system know we're alive
    try {
      await api.heartbeat(ctx.sessionId, "Context recovered via bv prime");
    } catch {
      // Silently ignore heartbeat failures
    }

    console.log("\n=== Ready ===");
  });
