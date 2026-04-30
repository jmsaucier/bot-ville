import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const doneCommand = new Command("done")
  .description("Signal that your task is complete")
  .option("-m, --message <message>", "Completion message")
  .action(async (options: { message?: string }) => {
    const ctx = getSessionContext();

    await api.done(ctx.sessionId, { message: options.message });

    console.log("Task completion signaled.");
    if (options.message) {
      console.log(`Message: ${options.message}`);
    }
  });
