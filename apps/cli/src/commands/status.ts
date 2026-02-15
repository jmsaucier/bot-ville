import { Command } from "commander";
import { api, getSessionContext } from "../api-client.js";

export const statusCommand = new Command("status")
  .description("Report a status update / heartbeat")
  .argument("[message]", "Optional status message")
  .action(async (message?: string) => {
    const ctx = getSessionContext();

    await api.heartbeat(ctx.sessionId, message);

    console.log(`Status reported${message ? `: ${message}` : "."}`);
  });
