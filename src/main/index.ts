import { app, BrowserWindow, dialog } from "electron";

import { createMainWindowOptions } from "./window-options";
import { runZattoServerProbe } from "./zatto-server-probe";

const ZATTO_SERVER_PROBE_ARGUMENT = "--smoke-test-zatto-server";
const isZattoServerProbe = process.argv.includes(ZATTO_SERVER_PROBE_ARGUMENT);

function reportStartupError(error: unknown): void {
  console.error("Zatto Desktop failed to start:", error);
  if (isZattoServerProbe) {
    app.exit(1);
    return;
  }
  dialog.showErrorBox(
    "Zatto Desktop could not start",
    "Close the application and try again.",
  );
}

async function startApplication(): Promise<void> {
  if (isZattoServerProbe) {
    const result = await runZattoServerProbe(
      app.getAppPath(),
      app.getPath("userData"),
    );
    console.log("Zatto server probe passed:", JSON.stringify(result));
    app.exit(0);
    return;
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow(
    createMainWindowOptions(MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY),
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(reportStartupError);

  return mainWindow;
}

void app.whenReady().then(startApplication).catch(reportStartupError);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
