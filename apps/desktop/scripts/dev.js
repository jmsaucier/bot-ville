import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// 1. Compile main process
const tsc = spawn("npx", ["tsc", "-p", "tsconfig.main.json"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

tsc.on("close", (code) => {
  if (code !== 0) {
    console.error("TypeScript compilation failed");
    process.exit(1);
  }

  // 2. Start Vite dev server for renderer
  const vite = spawn(
    "npx",
    ["vite", "--config", "src/renderer/vite.config.ts"],
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    }
  );

  // 3. Wait a moment for Vite to start, then launch Electron
  setTimeout(() => {
    const electron = spawn("npx", ["electron", "."], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });

    electron.on("close", () => {
      vite.kill();
      process.exit(0);
    });
  }, 3000);
});
