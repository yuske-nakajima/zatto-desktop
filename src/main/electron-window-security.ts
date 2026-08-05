import type { WebContents } from "electron";

import {
  configureWindowSecurity,
  type WindowSecurityTarget,
} from "./window-security";

function createSecurityTarget(webContents: WebContents): WindowSecurityTarget {
  return {
    on: (event, listener) => {
      if (event === "will-frame-navigate") {
        return webContents.on("will-frame-navigate", listener);
      }
      if (event === "will-navigate") {
        return webContents.on("will-navigate", listener);
      }
      return webContents.on("will-redirect", listener);
    },
    session: {
      setPermissionCheckHandler: (handler) =>
        webContents.session.setPermissionCheckHandler(handler),
      setPermissionRequestHandler: (handler) =>
        webContents.session.setPermissionRequestHandler(handler),
      webRequest: {
        onHeadersReceived: (listener) =>
          webContents.session.webRequest.onHeadersReceived(
            (details, callback) => listener(details, callback),
          ),
      },
    },
    setWindowOpenHandler: (handler) =>
      webContents.setWindowOpenHandler(handler),
  };
}

/**
 * Installs the security policy through Electron's typed WebContents API.
 *
 * @param webContents - WebContents secured before its first renderer load
 * @param getOwnershipUrl - Getter for validated manager ownership
 * @returns Nothing
 */
export function configureElectronWindowSecurity(
  webContents: WebContents,
  getOwnershipUrl: () => string | undefined,
): void {
  configureWindowSecurity(createSecurityTarget(webContents), getOwnershipUrl);
}
