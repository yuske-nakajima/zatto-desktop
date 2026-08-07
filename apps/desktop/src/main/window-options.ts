import type { BrowserWindowConstructorOptions } from "electron";

/** Persisted position and size accepted by the main window constructor. */
export interface MainWindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Builds the main window options with renderer privileges disabled.
 *
 * @param preloadPath - Absolute path to the bundled preload script
 * @param bounds - Validated bounds restored from user data
 * @param iconPath - Native window icon path when required by the platform
 * @returns BrowserWindow options for the application shell
 */
export function createMainWindowOptions(
  preloadPath: string,
  bounds: MainWindowBounds = { height: 720, width: 960, x: 0, y: 0 },
  iconPath?: string,
): BrowserWindowConstructorOptions {
  return {
    backgroundColor: "#f5f5f2",
    height: bounds.height,
    icon: iconPath,
    minHeight: Math.min(480, bounds.height),
    minWidth: Math.min(640, bounds.width),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:zatto-desktop-window",
      preload: preloadPath,
      sandbox: true,
      webSecurity: true,
    },
    width: bounds.width,
    x: bounds.x,
    y: bounds.y,
  };
}
