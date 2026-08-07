import { type BrowserWindow, dialog, ipcMain } from "electron";
import { addHtmlFiles } from "./html-file-add";
import { chooseHtmlFiles } from "./html-file-dialog";
import { registerHtmlFileDrop } from "./html-file-drop";
import { installApplicationMenu } from "./html-file-menu";
import { showAddedHtmlEntry } from "./html-file-navigation";
import { requestHtmlFileAdd } from "./html-file-request";
import { reportHtmlFileAddResult } from "./html-file-result";
import type { WindowManagerState } from "./window-flow";

/** Accessors used to connect HTML-file workflows to Electron. */
export interface ElectronHtmlFileOptions {
  ensureWindow: () => Promise<BrowserWindow | undefined>;
  getState: () => WindowManagerState;
  getWindow: () => BrowserWindow | undefined;
}

/**
 * Installs the native menu and restricted Finder-drop endpoint.
 *
 * @param options - Current application window and server-state accessors
 * @returns Nothing
 * @throws When Electron cannot register IPC or install the application menu
 */
export function configureElectronHtmlFiles(
  options: ElectronHtmlFileOptions,
): void {
  const addFiles = serializeHtmlFileAdds((paths: unknown) =>
    addHtmlFiles(paths, {
      getState: options.getState,
      request: requestHtmlFileAdd,
      showEntry: (entryId, ownershipUrl) =>
        showAddedHtmlEntry(
          options.getWindow(),
          options.getState(),
          entryId,
          ownershipUrl,
        ),
    }),
  );
  const reportResult = (result: Awaited<ReturnType<typeof addFiles>>) =>
    reportHtmlFileAddResult(result, options.getWindow());

  registerHtmlFileDrop({
    addFiles,
    getOwnershipUrl: () => options.getState().ownership?.url,
    getWindow: options.getWindow,
    ipcMain,
    reportResult,
  });
  installApplicationMenu(
    createSingleFlightAction(() =>
      openHtmlFileDialog(options, addFiles)
        .catch(() => reportResult({ status: "failed" }))
        .catch(() => {
          console.error("zatto could not report an HTML-file dialog failure.");
        }),
    ),
  );
}

/** Prevents repeated menu shortcuts from opening overlapping dialogs. */
export function createSingleFlightAction(
  operation: () => Promise<void>,
): () => void {
  let active: Promise<void> | undefined;
  return () => {
    if (active !== undefined) return;
    active = operation().finally(() => {
      active = undefined;
    });
  };
}

/** Serializes dialog and drop requests through one mutation queue. */
export function serializeHtmlFileAdds(
  operation: (
    paths: unknown,
  ) => Promise<import("./html-file-add").HtmlFileAddResult>,
): (paths: unknown) => Promise<import("./html-file-add").HtmlFileAddResult> {
  let tail = Promise.resolve();
  return (paths) => {
    const result = tail.then(() => operation(paths));
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

async function openHtmlFileDialog(
  options: ElectronHtmlFileOptions,
  addFiles: (paths: unknown) => ReturnType<typeof addHtmlFiles>,
): Promise<void> {
  const window = await options.ensureWindow();
  if (window === undefined || window.isDestroyed()) {
    await reportHtmlFileAddResult({ status: "server-stopped" }, window);
    return;
  }
  const result = await chooseHtmlFiles(window, {
    addFiles,
    showOpenDialog: (owner, dialogOptions) =>
      dialog.showOpenDialog(owner, dialogOptions),
  });
  await reportHtmlFileAddResult(result, window);
}
