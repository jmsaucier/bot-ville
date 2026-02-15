import { Command } from "commander";
import { getSessionContext } from "../api-client.js";

export const configCommand = new Command("config")
  .description("Show current session configuration")
  .action(() => {
    const ctx = getSessionContext();

    console.log("=== bot-ville Session Config ===\n");
    console.log(`API URL:        ${ctx.apiUrl}`);
    console.log(`Session ID:     ${ctx.sessionId}`);
    console.log(`Role:           ${ctx.role ?? "(not set)"}`);
    console.log(`Agent Preset:   ${ctx.agentPreset ?? "(not set)"}`);
    console.log(`Work Order ID:  ${ctx.workOrderId ?? "(not set)"}`);
    console.log(`Task ID:        ${ctx.taskId ?? "(not set)"}`);
  });
