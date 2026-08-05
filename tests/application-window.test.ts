import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  class FakeBrowserWindow {
    static created: FakeBrowserWindow[] = [];
    destroyed = false;
    readonly events = new Map<string, () => void>();
    readonly loadURL = vi.fn(async () => undefined);
    readonly options: Record<string, unknown>;
    readonly webContents = {
      on: vi.fn(),
      session: {
        setPermissionCheckHandler: vi.fn(),
        setPermissionRequestHandler: vi.fn(),
        webRequest: { onHeadersReceived: vi.fn() },
      },
      setWindowOpenHandler: vi.fn(),
    };

    constructor(options: Record<string, unknown>) {
      this.options = options;
      FakeBrowserWindow.created.push(this);
    }

    getNormalBounds() {
      return { height: 720, width: 960, x: 0, y: 0 };
    }
    readonly hide = vi.fn();
    isDestroyed() {
      return this.destroyed;
    }
    isFullScreen() {
      return false;
    }
    isMaximized() {
      return false;
    }
    maximize() {}
    on(name: string, listener: () => void) {
      this.events.set(name, listener);
    }
    once(name: string, listener: () => void) {
      this.events.set(name, listener);
    }
    setFullScreen() {}
    show() {}
  }
  return { FakeBrowserWindow, quit: vi.fn(), showErrorBox: vi.fn() };
});

vi.mock("electron", () => ({
  BrowserWindow: electron.FakeBrowserWindow,
  app: { quit: electron.quit },
  dialog: { showErrorBox: electron.showErrorBox },
}));

import { ApplicationWindow } from "../src/main/application-window";

describe("ApplicationWindow", () => {
  beforeEach(() => {
    electron.FakeBrowserWindow.created = [];
    electron.showErrorBox.mockReset();
    electron.quit.mockReset();
  });

  it("does not recreate a closed generation until explicit recreation", async () => {
    let workAreas = [{ height: 900, width: 1440, x: 0, y: 0 }];
    const managerState = {
      ownership: { url: "http://127.0.0.1:43120/" },
      status: "running" as const,
    };
    const applicationWindow = new ApplicationWindow({
      getManagerState: () => managerState,
      getWorkAreas: () => workAreas,
      preloadUrl: "file:///preload.js",
      rendererUrl: "file:///renderer.html",
      userDataPath: "/missing-user-data",
    });
    await applicationWindow.restore();
    const generation = applicationWindow.createGeneration();
    let destroyed = false;
    vi.spyOn(generation, "isDestroyed").mockImplementation(() => destroyed);
    vi.spyOn(generation, "loadURL").mockImplementation(async () => {
      destroyed = true;
      electron.FakeBrowserWindow.created[0]?.events.get("closed")?.();
      throw new Error("window closed");
    });

    await expect(applicationWindow.loadPreparation(generation)).resolves.toBe(
      "closed",
    );

    await expect(
      applicationWindow.loadZatto(generation, managerState.ownership.url),
    ).resolves.toBe("closed");
    await expect(applicationWindow.loadError(generation)).resolves.toBe(
      "closed",
    );
    expect(electron.FakeBrowserWindow.created).toHaveLength(1);

    workAreas = [{ height: 300, width: 400, x: -400, y: 20 }];
    await applicationWindow.recreateForManagerState();
    expect(electron.FakeBrowserWindow.created).toHaveLength(2);
    expect(electron.FakeBrowserWindow.created[1]?.options).toMatchObject({
      height: 300,
      width: 400,
      x: -400,
      y: 20,
    });
    expect(electron.FakeBrowserWindow.created[1]?.loadURL).toHaveBeenCalledWith(
      managerState.ownership.url,
    );
  });

  it("shares one recreation between activate and file-menu requests", async () => {
    const ownership = { url: "http://127.0.0.1:43120/" };
    const applicationWindow = new ApplicationWindow({
      getManagerState: () => ({ ownership, status: "running" }),
      getWorkAreas: () => [{ height: 900, width: 1440, x: 0, y: 0 }],
      preloadUrl: "file:///preload.js",
      rendererUrl: "file:///renderer.html",
      userDataPath: "/missing-user-data",
    });
    applicationWindow.createGeneration();
    electron.FakeBrowserWindow.created[0]?.events.get("closed")?.();

    await Promise.all([
      applicationWindow.recreateForManagerState(),
      applicationWindow.recreateForManagerState(),
    ]);

    expect(electron.FakeBrowserWindow.created).toHaveLength(2);
    expect(
      electron.FakeBrowserWindow.created[1]?.loadURL,
    ).toHaveBeenCalledOnce();
    expect(electron.FakeBrowserWindow.created[1]?.loadURL).toHaveBeenCalledWith(
      ownership.url,
    );
  });

  it("quits after showing a native error", async () => {
    const applicationWindow = new ApplicationWindow({
      getManagerState: () => ({ status: "failed" }),
      getWorkAreas: () => [{ height: 900, width: 1440, x: 0, y: 0 }],
      preloadUrl: "file:///preload.js",
      rendererUrl: "file:///renderer.html",
      userDataPath: "/missing-user-data",
    });
    const generation = applicationWindow.createGeneration();
    vi.spyOn(generation, "loadURL").mockRejectedValue(new Error("fail"));

    await expect(applicationWindow.loadError(generation)).resolves.toBe(
      "quitting",
    );
    expect(generation.loadURL).toHaveBeenCalledTimes(2);
    expect(electron.showErrorBox).toHaveBeenCalledOnce();
    expect(generation.hide).toHaveBeenCalledOnce();
    expect(electron.quit).toHaveBeenCalledOnce();
  });

  it("treats a zatto load rejection from window close as closed", async () => {
    const ownership = { url: "http://127.0.0.1:43120/" };
    const applicationWindow = new ApplicationWindow({
      getManagerState: () => ({ ownership, status: "running" }),
      getWorkAreas: () => [{ height: 900, width: 1440, x: 0, y: 0 }],
      preloadUrl: "file:///preload.js",
      rendererUrl: "file:///renderer.html",
      userDataPath: "/missing-user-data",
    });
    const generation = applicationWindow.createGeneration();
    let destroyed = false;
    vi.spyOn(generation, "isDestroyed").mockImplementation(() => destroyed);
    vi.spyOn(generation, "loadURL").mockImplementation(async () => {
      destroyed = true;
      electron.FakeBrowserWindow.created[0]?.events.get("closed")?.();
      throw new Error("window closed");
    });

    await expect(
      applicationWindow.loadZatto(generation, ownership.url),
    ).resolves.toBe("closed");
    expect(electron.FakeBrowserWindow.created).toHaveLength(1);
  });

  it("quits after every error-screen fallback fails", async () => {
    const applicationWindow = new ApplicationWindow({
      getManagerState: () => ({ status: "failed" }),
      getWorkAreas: () => [{ height: 900, width: 1440, x: 0, y: 0 }],
      preloadUrl: "file:///preload.js",
      rendererUrl: "file:///renderer.html",
      userDataPath: "/missing-user-data",
    });
    const generation = applicationWindow.createGeneration();
    vi.spyOn(generation, "loadURL").mockRejectedValue(new Error("fail"));
    electron.showErrorBox.mockImplementation(() => {
      throw new Error("native failure");
    });

    await expect(applicationWindow.loadError(generation)).resolves.toBe(
      "quitting",
    );
    expect(electron.quit).toHaveBeenCalledOnce();
    expect(generation.hide).toHaveBeenCalledOnce();
  });
});
