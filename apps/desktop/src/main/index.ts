import { app, BrowserWindow, screen } from "electron";
import {
  createStateFlushingStop,
  createZattoServerQuitHandler,
} from "./app-lifecycle";
import { ApplicationWindow } from "./application-window";
import { configureElectronHtmlFiles } from "./electron-html-files";
import { runWindowStartup } from "./window-flow";
import type { ZattoServerManager } from "./zatto-server-manager";
import { runZattoServerProbe } from "./zatto-server-probe";
import { createElectronZattoServerManager } from "./zatto-server-process";

const ZATTO_SERVER_PROBE_ARGUMENT = "--smoke-test-zatto-server";
const isZattoServerProbe = process.argv.includes(ZATTO_SERVER_PROBE_ARGUMENT);
let applicationWindow: ApplicationWindow | undefined;
let zattoServerManager: ZattoServerManager | undefined;

function getWorkAreas() {
  const primaryDisplay = screen.getPrimaryDisplay();
  return [
    primaryDisplay,
    ...screen
      .getAllDisplays()
      .filter((display) => display.id !== primaryDisplay.id),
  ].map((display) => display.workArea);
}

function settleWindowTask(operation: Promise<unknown>): void {
  void operation.catch(() => {
    console.error("zatto could not update its application window.");
  });
}

if (!isZattoServerProbe) {
  app.on(
    "before-quit",
    createZattoServerQuitHandler({
      quit: () => app.quit(),
      reportError: () => console.error("zatto could not stop its server."),
      stop: createStateFlushingStop({
        flushState: () => applicationWindow?.flush() ?? Promise.resolve(),
        reportStateError: () =>
          console.error("zatto could not save its window state."),
        stopServer: () => zattoServerManager?.stop() ?? Promise.resolve(),
      }),
    }),
  );
}

async function runProbe(): Promise<void> {
  const result = await runZattoServerProbe(
    app.getAppPath(),
    app.getPath("userData"),
  );
  console.log("zatto server probe passed:", JSON.stringify(result));
  app.exit(0);
}

async function startApplication(): Promise<void> {
  if (isZattoServerProbe) {
    await runProbe();
    return;
  }
  const window = new ApplicationWindow({
    getManagerState: () => zattoServerManager?.state ?? { status: "failed" },
    getWorkAreas,
    preloadUrl: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    rendererUrl: MAIN_WINDOW_WEBPACK_ENTRY,
    userDataPath: app.getPath("userData"),
  });
  applicationWindow = window;
  await window.restore();
  const manager = createElectronZattoServerManager(
    app.getAppPath(),
    app.getPath("userData"),
  );
  zattoServerManager = manager;
  manager.setUnexpectedErrorHandler(() => {
    console.error("zatto server stopped unexpectedly.");
    settleWindowTask(window.loadError());
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      settleWindowTask(window.recreateForManagerState());
    }
  });
  const result = await runWindowStartup({
    createGeneration: () => window.createGeneration(),
    loadError: (generation) => window.loadError(generation),
    loadPreparation: (generation) => window.loadPreparation(generation),
    loadZatto: (generation, url) => window.loadZatto(generation, url),
    startServer: () => manager.start(),
  });
  if (manager.state.status === "running") {
    configureElectronHtmlFiles({
      ensureWindow: async () => {
        if (manager.state.status !== "running") return undefined;
        const current = window.getWindow();
        if (current !== undefined && !current.isDestroyed()) return current;
        await window.recreateForManagerState();
        return window.getWindow();
      },
      getState: () => manager.state,
      getWindow: () => window.getWindow(),
    });
  }
  if (result === "failed") console.error("zatto could not start.");
}

function reportFatalStartupFailure(): void {
  console.error("zatto could not start.");
  if (isZattoServerProbe) {
    app.exit(1);
    return;
  }
  if (applicationWindow !== undefined) {
    settleWindowTask(applicationWindow.recreateForManagerState());
  }
}

void app.whenReady().then(startApplication).catch(reportFatalStartupFailure);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
