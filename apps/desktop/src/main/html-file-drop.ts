import type { BrowserWindow } from "electron";
import type { HtmlFileAddResult } from "./html-file-add";
import { normalizeHtmlFilePaths } from "./html-file-paths";
import { isAllowedOwnedNavigation } from "./owned-origin";

/** IPC channel reserved for OS-derived HTML-file drop paths. */
export const HTML_FILE_DROP_CHANNEL = "zatto-desktop:drop-html-files";

interface DropWindow {
  webContents: {
    mainFrame: unknown;
  };
}

interface DropEvent {
  sender: unknown;
  senderFrame: { url: string } | null;
}

interface DropIpcMain {
  on: (
    channel: string,
    listener: (event: DropEvent, payload: unknown) => void,
  ) => unknown;
}

/** Operations used to register the restricted drop IPC endpoint. */
export interface HtmlFileDropDependencies<Window extends DropWindow> {
  addFiles: (paths: unknown) => Promise<HtmlFileAddResult>;
  getOwnershipUrl: () => string | undefined;
  getWindow: () => Window | undefined;
  ipcMain: DropIpcMain;
  reportResult: (result: HtmlFileAddResult) => void | Promise<void>;
}

/**
 * Registers a sender-, frame-, URL-, and payload-validated drop handler.
 *
 * @param dependencies - IPC registration, active window, ownership, and add operations
 * @returns Nothing
 * @throws When Electron cannot register the IPC listener
 */
export function registerHtmlFileDrop<Window extends DropWindow = BrowserWindow>(
  dependencies: HtmlFileDropDependencies<Window>,
): void {
  dependencies.ipcMain.on(HTML_FILE_DROP_CHANNEL, (event, payload) => {
    if (!isTrustedDropEvent(event, dependencies)) return;
    const paths = normalizeHtmlFilePaths(payload);
    const value = paths.length === 0 ? payload : paths;
    void dependencies
      .addFiles(value)
      .then(dependencies.reportResult)
      .catch(() => dependencies.reportResult({ status: "failed" }))
      .catch(() => {
        console.error("zatto could not report an HTML-file add failure.");
      });
  });
}

function isTrustedDropEvent<Window extends DropWindow>(
  event: DropEvent,
  dependencies: HtmlFileDropDependencies<Window>,
): boolean {
  const window = dependencies.getWindow();
  const ownershipUrl = dependencies.getOwnershipUrl();
  return (
    window !== undefined &&
    ownershipUrl !== undefined &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame !== null &&
    isOwnedApplicationPage(event.senderFrame.url, ownershipUrl)
  );
}

function isOwnedApplicationPage(
  candidate: string,
  ownershipUrl: string,
): boolean {
  if (!isAllowedOwnedNavigation(candidate, ownershipUrl)) return false;
  const candidateUrl = new URL(candidate);
  const ownedUrl = new URL(ownershipUrl);
  return candidateUrl.pathname === ownedUrl.pathname;
}
