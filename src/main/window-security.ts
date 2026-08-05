import { createFrameSandboxPolicy } from "./frame-csp";
import {
  isAllowedOwnedFrameNavigation,
  isAllowedOwnedNavigation,
} from "./owned-origin";

export { createFrameSandboxPolicy } from "./frame-csp";
export {
  isAllowedOwnedFrameNavigation,
  isAllowedOwnedNavigation,
} from "./owned-origin";

/** Response details required to select untrusted zatto frame documents. */
export interface FrameResponseDetails {
  resourceType: string;
  responseHeaders?: Readonly<Record<string, readonly string[] | undefined>>;
  url: string;
}

/** Event that can cancel a renderer navigation. */
export interface PreventableNavigationEvent {
  isMainFrame?: boolean;
  preventDefault: () => void;
  url: string;
}

type NavigationEventName =
  | "will-frame-navigate"
  | "will-navigate"
  | "will-redirect";
type NavigationListener = (event: PreventableNavigationEvent) => void;
type HeadersCallback = (result: {
  responseHeaders?: Record<string, string[]>;
}) => void;

/** WebContents operations used to enforce the desktop security boundary. */
export interface WindowSecurityTarget {
  on: (event: NavigationEventName, listener: NavigationListener) => unknown;
  session: {
    setPermissionCheckHandler: (handler: () => boolean) => void;
    setPermissionRequestHandler: (
      handler: (
        webContents: unknown,
        permission: string,
        callback: (allowed: boolean) => void,
      ) => void,
    ) => void;
    webRequest: {
      onHeadersReceived: (
        listener: (
          details: FrameResponseDetails,
          callback: HeadersCallback,
        ) => void,
      ) => void;
    };
  };
  setWindowOpenHandler: (handler: () => { action: "deny" }) => void;
}

function isOwnedFrameDocument(
  details: FrameResponseDetails,
  ownershipUrl: string,
): boolean {
  return (
    details.resourceType === "subFrame" &&
    isAllowedOwnedNavigation(details.url, ownershipUrl)
  );
}

/**
 * Adds a unique-origin sandbox to owned-origin subframe documents.
 *
 * @param details - Response URL, resource type, and existing headers
 * @param ownershipUrl - Validated URL returned by the server manager
 * @returns A cloned header map with the sandbox policy when required
 */
export function appendFrameSandboxPolicy(
  details: FrameResponseDetails,
  ownershipUrl: string,
): Record<string, string[]> {
  const headers = Object.fromEntries(
    Object.entries(details.responseHeaders ?? {}).map(([name, values]) => [
      name,
      values === undefined ? [] : [...values],
    ]),
  );
  if (!isOwnedFrameDocument(details, ownershipUrl)) return headers;
  const cspHeader =
    Object.keys(headers).find(
      (name) => name.toLowerCase() === "content-security-policy",
    ) ?? "Content-Security-Policy";
  headers[cspHeader] = [
    ...(headers[cspHeader] ?? []),
    createFrameSandboxPolicy(details.url, ownershipUrl),
  ];
  return headers;
}

/**
 * Installs navigation, window, permission, and frame-response restrictions.
 *
 * @param target - WebContents-compatible security operations
 * @param ownership - Owned URL or a getter for manager state
 * @returns Nothing
 */
export function configureWindowSecurity(
  target: WindowSecurityTarget,
  ownership: string | (() => string | undefined),
): void {
  const getOwnership =
    typeof ownership === "string" ? () => ownership : ownership;
  const guard: NavigationListener = (event) => {
    const ownedUrl = getOwnership();
    if (
      ownedUrl === undefined ||
      !isAllowedOwnedNavigation(event.url, ownedUrl)
    ) {
      event.preventDefault();
    }
  };
  const frameGuard: NavigationListener = (event) => {
    const ownedUrl = getOwnership();
    if (
      ownedUrl === undefined ||
      !isAllowedOwnedFrameNavigation(event.url, ownedUrl)
    ) {
      event.preventDefault();
    }
  };
  const redirectGuard: NavigationListener = (event) => {
    if (event.isMainFrame === false) frameGuard(event);
    else guard(event);
  };
  const frameEventGuard: NavigationListener = (event) => {
    if (event.isMainFrame === true) guard(event);
    else frameGuard(event);
  };
  target.on("will-navigate", guard);
  target.on("will-redirect", redirectGuard);
  target.on("will-frame-navigate", frameEventGuard);
  target.setWindowOpenHandler(() => ({ action: "deny" }));
  target.session.setPermissionCheckHandler(() => false);
  target.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  target.session.webRequest.onHeadersReceived((details, callback) => {
    const ownedUrl = getOwnership();
    callback({
      responseHeaders:
        ownedUrl === undefined
          ? appendFrameSandboxPolicy(details, "invalid:")
          : appendFrameSandboxPolicy(details, ownedUrl),
    });
  });
}
