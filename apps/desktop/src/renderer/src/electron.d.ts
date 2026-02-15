/** Type declarations for the Electron preload bridge exposed on window.electronAPI */

interface ElectronAPI {
  platform: string;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  openDirectoryDialog: () => Promise<string | null>;
  getWebDashboardInfo: () => Promise<{ url: string; running: boolean }>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
