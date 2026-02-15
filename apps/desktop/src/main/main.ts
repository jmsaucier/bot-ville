import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = "http://localhost:5173";
const WEB_APP_PORT = 3000;
const isDev = !app.isPackaged;

/** Resolve the repo root (two levels up from dist/main/) */
function getRepoRoot(): string {
  if (isDev) {
    // In dev, __dirname is apps/desktop/dist/main/
    return path.resolve(__dirname, "..", "..", "..", "..");
  }
  // In packaged app, adjust as needed
  return path.resolve(__dirname, "..", "..", "..", "..");
}

// ─── Web App Process Management ─────────────────────────────────────────────

let webAppProcess: ChildProcess | null = null;

function startWebApp(): void {
  const repoRoot = getRepoRoot();
  const webAppDir = path.join(repoRoot, "apps", "web");

  const command = isDev ? "next" : "next";
  const args = isDev
    ? ["dev", "--port", String(WEB_APP_PORT)]
    : ["start", "--port", String(WEB_APP_PORT)];

  webAppProcess = spawn("npx", [command, ...args], {
    cwd: webAppDir,
    stdio: "pipe",
    shell: true,
    detached: false,
  });

  webAppProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[web] ${data.toString().trim()}`);
  });

  webAppProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[web] ${data.toString().trim()}`);
  });

  webAppProcess.on("error", (err) => {
    console.error("[web] Failed to start web app:", err.message);
    webAppProcess = null;
  });

  webAppProcess.on("exit", (code) => {
    console.log(`[web] Web app exited with code ${code}`);
    webAppProcess = null;
  });

  console.log(
    `[web] Starting web dashboard on http://localhost:${WEB_APP_PORT}`
  );
}

function stopWebApp(): void {
  if (webAppProcess && !webAppProcess.killed) {
    webAppProcess.kill("SIGTERM");

    // Force kill after 5 seconds if still alive
    const forceKillTimeout = setTimeout(() => {
      if (webAppProcess && !webAppProcess.killed) {
        webAppProcess.kill("SIGKILL");
      }
    }, 5000);

    webAppProcess.once("exit", () => {
      clearTimeout(forceKillTimeout);
    });
  }
  webAppProcess = null;
}

// ─── Window Management ──────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Farm Ops Console",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  return win;
}

async function waitForDevServer(
  url: string,
  retries = 60,
  interval = 500
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `Dev server at ${url} did not respond after ${retries} attempts`
  );
}

async function loadApp(win: BrowserWindow): Promise<void> {
  if (isDev) {
    await waitForDevServer(DEV_SERVER_URL);
    await win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // Load built renderer
    await win.loadFile(
      path.join(__dirname, "..", "renderer", "index.html")
    );
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  // Native directory picker dialog
  ipcMain.handle("dialog:open-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Project Directory",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Get web dashboard info
  ipcMain.handle("web:get-info", () => {
    return {
      url: `http://localhost:${WEB_APP_PORT}`,
      running: webAppProcess !== null && !webAppProcess.killed,
    };
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();
  startWebApp();

  const mainWindow = createWindow();
  await loadApp(mainWindow);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      await loadApp(win);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopWebApp();
});
