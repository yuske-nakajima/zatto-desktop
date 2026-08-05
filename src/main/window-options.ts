import type { BrowserWindowConstructorOptions } from "electron";

/**
 * Builds the main window options with renderer privileges disabled.
 *
 * @param preloadPath - Absolute path to the bundled preload script
 * @returns BrowserWindow options for the application shell
 */
export function createMainWindowOptions(
  preloadPath: string,
): BrowserWindowConstructorOptions {
  return {
    backgroundColor: "#f5f5f2",
    height: 720,
    minHeight: 480,
    minWidth: 640,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
      webSecurity: true,
    },
    width: 960,
  };
}
