import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const tasksCommand = new Command("tasks")
  .description("List tasks in the current work order")
  .action(async () => {
    const ctx = getSessionContext();

    if (!ctx.workOrderId) {
      console.error("Error: No work order assigned (BV_WORK_ORDER_ID not set).");
      process.exit(1);
    }

    const tasks = (await api.listTasks(ctx.workOrderId)) as {
      id: string;
      title: string;
      status: string;
      ownerRole: string | null;
      description: string;
    }[];

    if (tasks.length === 0) {
      console.log("No tasks found.");
      return;
    }

    console.log(`Tasks for work order ${ctx.workOrderId.slice(0, 8)}...\n`);
    console.log(
      "STATUS".padEnd(14) +
        "ROLE".padEnd(18) +
        "TITLE".padEnd(40) +
        "ID"
    );
    console.log("-".repeat(80));

    for (const task of tasks) {
      const mine = task.id === ctx.taskId ? " *" : "";
      console.log(
        task.status.padEnd(14) +
          (task.ownerRole ?? "-").padEnd(18) +
          task.title.slice(0, 38).padEnd(40) +
          task.id.slice(0, 8) +
          mine
      );
    }

    console.log(`\n${tasks.length} task(s). (* = your assigned task)`);
  });
