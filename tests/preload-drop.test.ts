import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  getPathForFile: vi.fn((file: { name: string }) => `/tmp/${file.name}`),
  send: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcRenderer: { send: electron.send },
  webUtils: { getPathForFile: electron.getPathForFile },
}));

describe("preload file drop", () => {
  beforeEach(() => {
    vi.resetModules();
    electron.getPathForFile.mockClear();
    electron.send.mockClear();
  });

  it("resolves Finder files inside preload and sends only HTML paths", async () => {
    const listeners = new Map<
      string,
      (event: Record<string, unknown>) => void
    >();
    vi.stubGlobal("document", {
      addEventListener: (
        name: string,
        listener: (event: Record<string, unknown>) => void,
      ) => listeners.set(name, listener),
    });
    await import("../src/preload/index.js");
    const preventDefault = vi.fn();
    listeners.get("drop")?.({
      dataTransfer: {
        files: [
          { name: "first.html" },
          { name: "notes.txt" },
          { name: "SECOND.HTM" },
        ],
      },
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(electron.getPathForFile).toHaveBeenCalledTimes(2);
    expect(electron.send).toHaveBeenCalledWith(
      "zatto-desktop:drop-html-files",
      ["/tmp/first.html", "/tmp/SECOND.HTM"],
    );
  });

  it("rejects an oversized batch before resolving any absolute paths", async () => {
    const listeners = new Map<
      string,
      (event: Record<string, unknown>) => void
    >();
    vi.stubGlobal("document", {
      addEventListener: (
        name: string,
        listener: (event: Record<string, unknown>) => void,
      ) => listeners.set(name, listener),
    });
    await import("../src/preload/index.js");
    listeners.get("drop")?.({
      dataTransfer: {
        files: Array.from({ length: 300 }, (_, index) => ({
          name: `${index}.html`,
        })),
      },
      preventDefault: vi.fn(),
    });

    expect(electron.getPathForFile).not.toHaveBeenCalled();
    expect(electron.send).toHaveBeenCalledWith(
      "zatto-desktop:drop-html-files",
      { kind: "too-many-files" },
    );
  });
});
