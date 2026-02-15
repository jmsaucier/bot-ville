#!/usr/bin/env node

import { Command } from "commander";
import { primeCommand } from "./commands/prime.js";
import { statusCommand } from "./commands/status.js";
import { doneCommand } from "./commands/done.js";
import { artifactCommand } from "./commands/artifact.js";
import { tasksCommand } from "./commands/tasks.js";
import { eventsCommand } from "./commands/events.js";
import { mailCommand } from "./commands/mail.js";
import { configCommand } from "./commands/config.js";

const program = new Command();

program
  .name("bv")
  .description(
    "bot-ville CLI -- agent-side interface for the farm orchestration system"
  )
  .version("0.0.0");

program.addCommand(primeCommand);
program.addCommand(statusCommand);
program.addCommand(doneCommand);
program.addCommand(artifactCommand);
program.addCommand(tasksCommand);
program.addCommand(eventsCommand);
program.addCommand(mailCommand);
program.addCommand(configCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
