import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { api, getSessionContext } from "../api-client.js";

export const artifactCommand = new Command("artifact")
  .description("Manage artifacts");

artifactCommand
  .command("submit <file>")
  .description("Submit a file as a draft artifact")
  .option("-t, --type <type>", "Artifact type (auto-detected from extension if omitted)")
  .action(async (file: string, options: { type?: string }) => {
    const ctx = getSessionContext();

    if (!ctx.taskId) {
      console.error("Error: No task assigned (BV_TASK_ID not set).");
      process.exit(1);
    }

    if (!ctx.workOrderId) {
      console.error("Error: No work order assigned (BV_WORK_ORDER_ID not set).");
      process.exit(1);
    }

    if (!ctx.role) {
      console.error("Error: No role assigned (BV_ROLE not set).");
      process.exit(1);
    }

    const content = await readFile(file, "utf-8");
    const artifactType = options.type ?? inferType(file);

    await api.submitArtifact(ctx.taskId, {
      type: artifactType,
      content,
      roleId: ctx.role,
      workOrderId: ctx.workOrderId,
    });

    console.log(`Artifact submitted: ${basename(file)} (type: ${artifactType})`);
  });

function inferType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const typeMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript-react",
    ".js": "javascript",
    ".jsx": "javascript-react",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".css": "css",
    ".html": "html",
    ".sql": "sql",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
  };
  return typeMap[ext] ?? "text";
}
