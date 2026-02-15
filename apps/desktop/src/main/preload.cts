import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args);
  },

  on: (
    channel: string,
    callback: (...args: unknown[]) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      ...args: unknown[]
    ) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  /** Open native directory picker dialog. Returns the selected path or null. */
  openDirectoryDialog: (): Promise<string | null> => {
    return ipcRenderer.invoke("dialog:open-directory") as Promise<string | null>;
  },

  /** Get web dashboard info (URL and running status). */
  getWebDashboardInfo: (): Promise<{ url: string; running: boolean }> => {
    return ipcRenderer.invoke("web:get-info") as Promise<{ url: string; running: boolean }>;
  },
});
