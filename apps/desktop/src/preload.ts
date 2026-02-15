import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a type-safe API to the renderer process via `window.electronAPI`.
 *
 * Context isolation is enabled, so the renderer cannot access Node.js or
 * Electron APIs directly -- only what is explicitly exposed here.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Returns the current platform (e.g. "win32", "darwin", "linux").
   */
  platform: process.platform,

  /**
   * Send a message to the main process on a given channel.
   */
  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args);
  },

  /**
   * Listen for messages from the main process on a given channel.
   * Returns a cleanup function to remove the listener.
   */
  on: (
    channel: string,
    callback: (...args: unknown[]) => void,
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  /**
   * Invoke a handler in the main process and await its result.
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },
});
