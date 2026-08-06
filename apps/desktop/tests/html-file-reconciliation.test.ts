import { describe, expect, it, vi } from "vitest";

import { addHtmlFiles } from "../src/main/html-file-add";

const OWNERSHIP_URL = "http://127.0.0.1:49152/";
const preparePaths = async () => ({
  paths: ["/tmp/page.html"],
  status: "ready" as const,
});

describe("interrupted HTML-file adds", () => {
  it("preserves the stopped-server fact when the result is uncertain", async () => {
    let running = true;
    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: () =>
          running
            ? { ownership: { url: OWNERSHIP_URL }, status: "running" }
            : { status: "idle" },
        inspectSession: vi.fn(async () => []),
        preparePaths,
        request: vi.fn(async () => {
          running = false;
          throw new Error("server stopped");
        }),
        showEntry: vi.fn(),
      }),
    ).resolves.toEqual({ serverStopped: true, status: "unknown" });
  });

  it("does not mistake an existing entry for a recovered add", async () => {
    const inspectSession = vi
      .fn()
      .mockRejectedValueOnce(new Error("preflight failed"))
      .mockResolvedValueOnce([{ absPath: "/tmp/page.html", id: "existing" }]);
    const showEntry = vi.fn();

    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: () => ({
          ownership: { url: OWNERSHIP_URL },
          status: "running",
        }),
        inspectSession,
        preparePaths,
        request: vi.fn(async () => {
          throw new Error("response interrupted");
        }),
        showEntry,
      }),
    ).resolves.toEqual({ serverStopped: false, status: "unknown" });
    expect(showEntry).not.toHaveBeenCalled();
  });
});
