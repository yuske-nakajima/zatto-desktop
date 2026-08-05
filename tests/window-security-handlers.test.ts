import { describe, expect, it, vi } from "vitest";

import {
  configureWindowSecurity,
  createFrameSandboxPolicy,
} from "../src/main/window-security";

interface PreventableEvent {
  isMainFrame?: boolean;
  preventDefault: () => void;
  url: string;
}

describe("configureWindowSecurity", () => {
  it("blocks spoofed navigation, redirects, frame navigation, and windows", () => {
    const listeners = new Map<string, (event: PreventableEvent) => void>();
    const setWindowOpenHandler = vi.fn();
    const setPermissionRequestHandler = vi.fn();
    const setPermissionCheckHandler = vi.fn();
    const onHeadersReceived = vi.fn();

    configureWindowSecurity(
      {
        on: (name, listener) => listeners.set(name, listener),
        session: {
          setPermissionCheckHandler,
          setPermissionRequestHandler,
          webRequest: { onHeadersReceived },
        },
        setWindowOpenHandler,
      },
      "http://127.0.0.1:43120/",
    );

    for (const eventName of [
      "will-navigate",
      "will-redirect",
      "will-frame-navigate",
    ]) {
      const event = {
        preventDefault: vi.fn(),
        url: "https://example.com/",
      };
      listeners.get(eventName)?.(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }

    const ownedFrame = {
      isMainFrame: false,
      preventDefault: vi.fn(),
      url: "http://127.0.0.1:43120/f/example/",
    };
    listeners.get("will-frame-navigate")?.(ownedFrame);
    expect(ownedFrame.preventDefault).not.toHaveBeenCalled();
    const ownedApiFrame = {
      isMainFrame: false,
      preventDefault: vi.fn(),
      url: "http://127.0.0.1:43120/api/session",
    };
    listeners.get("will-frame-navigate")?.(ownedApiFrame);
    expect(ownedApiFrame.preventDefault).toHaveBeenCalledOnce();
    expect(setWindowOpenHandler.mock.calls[0]?.[0]()).toEqual({
      action: "deny",
    });
    expect(setPermissionCheckHandler.mock.calls[0]?.[0]()).toBe(false);
    const permissionCallback = vi.fn();
    setPermissionRequestHandler.mock.calls[0]?.[0](
      undefined,
      "notifications",
      permissionCallback,
    );
    expect(permissionCallback).toHaveBeenCalledWith(false);

    const headersListener = onHeadersReceived.mock.calls[0]?.[0];
    const headersCallback = vi.fn();
    headersListener(
      {
        resourceType: "subFrame",
        responseHeaders: {
          "content-security-policy": ["default-src 'self'"],
          ETag: ["frame"],
        },
        url: "http://127.0.0.1:43120/%66/example/",
      },
      headersCallback,
    );
    expect(headersCallback).toHaveBeenCalledOnce();
    expect(headersCallback).toHaveBeenCalledWith({
      responseHeaders: {
        ETag: ["frame"],
        "content-security-policy": [
          "default-src 'self'",
          createFrameSandboxPolicy(
            "http://127.0.0.1:43120/%66/example/",
            "http://127.0.0.1:43120/",
          ),
        ],
      },
    });
  });

  it("blocks every renderer navigation before ownership is available", () => {
    let ownedUrl: string | undefined;
    const listeners = new Map<string, (event: PreventableEvent) => void>();
    const onHeadersReceived = vi.fn();
    configureWindowSecurity(
      {
        on: (name, listener) => listeners.set(name, listener),
        session: {
          setPermissionCheckHandler: vi.fn(),
          setPermissionRequestHandler: vi.fn(),
          webRequest: { onHeadersReceived },
        },
        setWindowOpenHandler: vi.fn(),
      },
      () => ownedUrl,
    );
    const beforeOwnership = {
      preventDefault: vi.fn(),
      url: "http://127.0.0.1:43120/",
    };
    listeners.get("will-navigate")?.(beforeOwnership);
    expect(beforeOwnership.preventDefault).toHaveBeenCalledOnce();

    const headersCallback = vi.fn();
    onHeadersReceived.mock.calls[0]?.[0](
      {
        resourceType: "subFrame",
        responseHeaders: { ETag: ["pending"] },
        url: "http://127.0.0.1:43120/%66/example/",
      },
      headersCallback,
    );
    expect(headersCallback).toHaveBeenCalledOnce();
    expect(headersCallback).toHaveBeenCalledWith({
      responseHeaders: { ETag: ["pending"] },
    });

    ownedUrl = "http://127.0.0.1:43120/";
    const afterOwnership = {
      preventDefault: vi.fn(),
      url: "http://127.0.0.1:43120/",
    };
    listeners.get("will-navigate")?.(afterOwnership);
    expect(afterOwnership.preventDefault).not.toHaveBeenCalled();
  });
});
