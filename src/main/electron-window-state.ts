import type { BrowserWindow } from "electron";

import type { WindowState } from "./window-state";

/**
 * Reads the restorable state of one BrowserWindow generation.
 *
 * @param window - BrowserWindow being captured
 * @returns Normal bounds and display-mode flags
 */
export function captureElectronWindowState(window: BrowserWindow): WindowState {
  return {
    bounds: window.getNormalBounds(),
    isFullScreen: window.isFullScreen(),
    isMaximized: window.isMaximized(),
  };
}

/**
 * Captures state after every display-mode or normal-bounds change.
 *
 * @param window - BrowserWindow being observed
 * @param capture - Receives a current state snapshot
 * @returns Nothing
 */
export function attachElectronWindowStateCapture(
  window: BrowserWindow,
  capture: (state: WindowState) => void,
): void {
  const snapshot = () => capture(captureElectronWindowState(window));
  window.on("close", snapshot);
  window.on("enter-full-screen", snapshot);
  window.on("leave-full-screen", snapshot);
  window.on("maximize", snapshot);
  window.on("move", snapshot);
  window.on("resize", snapshot);
  window.on("unmaximize", snapshot);
}
