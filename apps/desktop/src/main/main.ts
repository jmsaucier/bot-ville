import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = "http://localhost:5173";
const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Farm Ops Console",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

app.whenReady().then(async () => {
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
