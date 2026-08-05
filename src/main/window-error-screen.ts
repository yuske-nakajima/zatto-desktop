import { app, type BrowserWindow, dialog } from "electron";

const FALLBACK_ERROR_URL =
  "data:text/html;charset=utf-8,%3Ctitle%3EZatto%20Desktop%3C%2Ftitle%3E%3Cmain%3E%3Ch1%3EZatto%20Desktop%20could%20not%20start%3C%2Fh1%3E%3Cp%3EClose%20the%20application%20and%20try%20again.%3C%2Fp%3E%3C%2Fmain%3E";

/**
 * Loads bundled, data-URL, then native error UI for an active window.
 *
 * @param window - Existing window generation that encountered an error
 * @param bundledErrorUrl - Bundled static error-screen URL
 * @param isActive - Checks that the user has not closed or replaced the window
 * @returns Whether an error was displayed or the generation was closed
 */
export async function loadWindowErrorScreen(
  window: BrowserWindow,
  bundledErrorUrl: string,
  isActive: () => boolean,
): Promise<"closed" | "loaded" | "quitting"> {
  for (const url of [bundledErrorUrl, FALLBACK_ERROR_URL]) {
    if (!isActive()) return "closed";
    try {
      await window.loadURL(url);
      return isActive() ? "loaded" : "closed";
    } catch {
      if (!isActive()) return "closed";
    }
  }
  console.error("Zatto Desktop could not display its error screen.");
  try {
    dialog.showErrorBox(
      "Zatto Desktop could not start",
      "Close the application and try again.",
    );
  } catch {
    console.error("Zatto Desktop could not display its native error.");
  }
  try {
    window.hide();
  } catch {
    console.error("Zatto Desktop could not hide its failed window.");
  }
  try {
    app.quit();
  } catch {
    console.error("Zatto Desktop could not request application shutdown.");
  }
  return "quitting";
}
