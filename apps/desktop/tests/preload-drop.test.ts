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
    vi.useRealTimers();
    electron.getPathForFile.mockClear();
    electron.send.mockClear();
  });

  it("opens a full-window shield for native files and shows the HTML count", async () => {
    const harness = createDocumentHarness();
    vi.stubGlobal("document", harness.document);
    await import("../src/preload/index.js");
    const preventDefault = vi.fn();

    harness.dispatch("dragenter", {
      dataTransfer: {
        files: [
          { name: "first.html" },
          { name: "notes.txt" },
          { name: "second.htm" },
        ],
        types: ["Files"],
      },
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(harness.byId("zatto-desktop-drop-shield").dataset.state).toBe(
      "active",
    );
    expect(harness.byId("zatto-desktop-drop-count").textContent).toBe(
      "2 HTML files ready",
    );
    expect(harness.styleText()).toContain("prefers-reduced-motion: reduce");
    expect(harness.styleText()).toContain("position: fixed");
    expect(harness.styleText()).toContain("background: rgb(15 23 42 / 82%)");
    expect(harness.styleText()).toContain(
      "border: 1px solid rgb(255 255 255 / 72%)",
    );
    expect(harness.styleText()).not.toContain("gradient(");
    expect(harness.styleText()).not.toContain("box-shadow");
    expect(harness.styleText()).not.toContain("@keyframes");
  });

  it("does not let a previous drop timer close a later drag", async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    vi.stubGlobal("document", harness.document);
    await import("../src/preload/index.js");
    const fileDrag = {
      dataTransfer: { files: [{ name: "page.html" }], types: ["Files"] },
      preventDefault: vi.fn(),
    };

    harness.dispatch("drop", fileDrag);
    harness.dispatch("dragenter", fileDrag);
    vi.advanceTimersByTime(320);

    expect(harness.byId("zatto-desktop-drop-shield").dataset.state).toBe(
      "active",
    );
    harness.dispatch("dragend", {});
    expect(harness.byId("zatto-desktop-drop-shield").dataset.state).toBe(
      "idle",
    );
  });

  it("keeps internal list drags unchanged and closes when a file drag leaves", async () => {
    const harness = createDocumentHarness();
    vi.stubGlobal("document", harness.document);
    await import("../src/preload/index.js");
    const preventDefault = vi.fn();

    harness.dispatch("dragenter", {
      dataTransfer: { files: [{ name: "page.html" }], types: ["Files"] },
      preventDefault,
    });
    harness.dispatch("dragleave", {
      clientX: -1,
      clientY: 20,
      relatedTarget: null,
    });
    expect(harness.byId("zatto-desktop-drop-shield").dataset.state).toBe(
      "idle",
    );

    harness.dispatch("dragenter", {
      dataTransfer: { files: [], types: ["text/plain"] },
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(harness.byId("zatto-desktop-drop-shield").dataset.state).toBe(
      "idle",
    );
  });

  it("resolves file-manager files inside preload and sends only HTML paths", async () => {
    const harness = createDocumentHarness();
    vi.stubGlobal("document", harness.document);
    await import("../src/preload/index.js");
    const preventDefault = vi.fn();
    harness.dispatch("drop", {
      dataTransfer: {
        files: [
          { name: "first.html" },
          { name: "notes.txt" },
          { name: "SECOND.HTM" },
        ],
        types: ["Files"],
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
    const harness = createDocumentHarness();
    vi.stubGlobal("document", harness.document);
    await import("../src/preload/index.js");
    harness.dispatch("drop", {
      dataTransfer: {
        files: Array.from({ length: 300 }, (_, index) => ({
          name: `${index}.html`,
        })),
        types: ["Files"],
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

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  id = "";
  textContent = "";

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  removeAttribute(_name: string): void {}

  setAttribute(_name: string, _value: string): void {}
}

function createDocumentHarness() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const elements: FakeElement[] = [];
  const documentElement = new FakeElement();
  const body = new FakeElement();
  const document = {
    addEventListener: (
      name: string,
      listener: (event: Record<string, unknown>) => void,
    ) => listeners.set(name, listener),
    body,
    createElement: () => {
      const element = new FakeElement();
      elements.push(element);
      return element;
    },
    documentElement,
    readyState: "complete",
    getElementById: (id: string) =>
      elements.find((element) => element.id === id),
  };
  return {
    byId(id: string) {
      const element = document.getElementById(id);
      if (element === undefined) throw new Error(`Missing element: ${id}`);
      return element;
    },
    dispatch(name: string, event: Record<string, unknown>) {
      listeners.get(name)?.(event);
    },
    document,
    styleText() {
      return elements.map((element) => element.textContent).join("\n");
    },
  };
}
