import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_WINDOW_STATE,
  normalizeWindowState,
  parseWindowState,
  WindowStateStore,
} from "../src/main/window-state";

describe("parseWindowState", () => {
  it("parses valid window state", () => {
    expect(
      parseWindowState(
        JSON.stringify({
          bounds: { height: 700, width: 900, x: 20, y: 30 },
          isFullScreen: true,
          isMaximized: false,
        }),
      ),
    ).toEqual({
      bounds: { height: 700, width: 900, x: 20, y: 30 },
      isFullScreen: true,
      isMaximized: false,
    });
  });

  it.each([
    "{",
    "null",
    "{}",
    '{"bounds":{"x":"bad"}}',
    '{"bounds":{"x":1.5,"y":0,"width":900,"height":700},"isFullScreen":false,"isMaximized":false}',
    '{"bounds":{"x":1e999,"y":0,"width":900,"height":700},"isFullScreen":false,"isMaximized":false}',
    `{"bounds":{"x":${Number.MAX_SAFE_INTEGER + 1},"y":0,"width":900,"height":700},"isFullScreen":false,"isMaximized":false}`,
  ])("falls back for corrupt or invalid state: %s", (stored) =>
    expect(parseWindowState(stored)).toEqual(DEFAULT_WINDOW_STATE),
  );
});

describe("normalizeWindowState", () => {
  it("clamps partially visible bounds into the selected display", () => {
    const state = {
      bounds: { height: 700, width: 900, x: 1439, y: 899 },
      isFullScreen: false,
      isMaximized: true,
    };
    expect(
      normalizeWindowState(state, [{ height: 900, width: 1440, x: 0, y: 0 }]),
    ).toEqual({
      ...state,
      bounds: { height: 700, width: 900, x: 540, y: 200 },
    });
  });

  it("moves fully off-screen bounds into an available work area", () => {
    expect(
      normalizeWindowState(
        {
          bounds: { height: 900, width: 1600, x: 5000, y: -4000 },
          isFullScreen: false,
          isMaximized: false,
        },
        [{ height: 800, width: 1200, x: 100, y: 50 }],
      ),
    ).toEqual({
      bounds: { height: 800, width: 1200, x: 100, y: 50 },
      isFullScreen: false,
      isMaximized: false,
    });
  });

  it("uses minimum size when the work area can contain it", () => {
    expect(
      normalizeWindowState(
        {
          bounds: { height: 20, width: 30, x: 0, y: 0 },
          isFullScreen: false,
          isMaximized: false,
        },
        [{ height: 900, width: 1440, x: 0, y: 0 }],
      ).bounds,
    ).toEqual({ height: 480, width: 640, x: 0, y: 0 });
  });

  it("fits a work area smaller than the minimum size", () => {
    expect(
      normalizeWindowState(DEFAULT_WINDOW_STATE, [
        { height: 300, width: 400, x: -400, y: 20 },
      ]).bounds,
    ).toEqual({ height: 300, width: 400, x: -400, y: 20 });
  });
});

describe("WindowStateStore", () => {
  it("loads normalized state and saves the latest captured state", async () => {
    const write = vi.fn(async () => undefined);
    const store = new WindowStateStore("/user/data", {
      read: vi.fn(async () =>
        JSON.stringify({
          bounds: { height: 600, width: 800, x: 10, y: 20 },
          isFullScreen: false,
          isMaximized: false,
        }),
      ),
      rename: vi.fn(async () => undefined),
      write,
    });

    await expect(
      store.load([{ height: 900, width: 1440, x: 0, y: 0 }]),
    ).resolves.toEqual({
      bounds: { height: 600, width: 800, x: 10, y: 20 },
      isFullScreen: false,
      isMaximized: false,
    });
    store.capture({
      bounds: { height: 720, width: 960, x: 30, y: 40 },
      isFullScreen: true,
      isMaximized: true,
    });
    await store.flush();

    expect(write).toHaveBeenCalledWith(
      path.join("/user/data", "window-state.json.tmp"),
      JSON.stringify({
        bounds: { height: 720, width: 960, x: 30, y: 40 },
        isFullScreen: true,
        isMaximized: true,
      }),
    );
  });

  it.each(["write", "rename"])(
    "does not replace the state file when atomic %s fails",
    async (failurePoint) => {
      const statePath = path.join("/user/data", "window-state.json");
      const files = new Map([[statePath, "previous"]]);
      const store = new WindowStateStore("/user/data", {
        read: async (filePath) => files.get(filePath) ?? "",
        rename: async (source, destination) => {
          if (failurePoint === "rename") throw new Error("rename failed");
          files.set(destination, files.get(source) ?? "");
        },
        write: async (filePath, contents) => {
          if (failurePoint === "write") throw new Error("write failed");
          files.set(filePath, contents);
        },
      });

      await expect(store.flush()).rejects.toThrow();
      expect(files.get(statePath)).toBe("previous");
    },
  );
});
