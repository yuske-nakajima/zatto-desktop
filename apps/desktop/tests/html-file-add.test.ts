import { describe, expect, it, vi } from "vitest";

import { addHtmlFiles } from "../src/main/html-file-add";
import { normalizeHtmlFilePaths } from "../src/main/html-file-paths";

const OWNERSHIP_URL = "http://127.0.0.1:49152/";
const preparePaths = async (value: unknown) => {
  const paths = normalizeHtmlFilePaths(value);
  return paths.length === 0
    ? ({ status: "unchanged" } as const)
    : ({ paths, status: "ready" } as const);
};
const inspectSession = async () => [];

describe("addHtmlFiles", () => {
  it("posts absolute paths to the owned endpoint and displays the first added entry", async () => {
    const request = vi.fn(async () => ({
      body: { added: [{ id: "first" }, { id: "second" }] },
      status: 201,
    }));
    const showEntry = vi.fn(async () => undefined);
    const getState = () => ({
      ownership: { url: OWNERSHIP_URL },
      status: "running" as const,
    });

    await expect(
      addHtmlFiles(["/tmp/first.html", "/tmp/second.htm"], {
        getState,
        inspectSession,
        preparePaths,
        request,
        showEntry,
      }),
    ).resolves.toEqual({
      addedCount: 2,
      display: "shown",
      status: "added",
    });
    expect(request).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/api/session/add",
      ["/tmp/first.html", "/tmp/second.htm"],
      expect.any(AbortSignal),
    );
    expect(showEntry).toHaveBeenCalledWith("first", OWNERSHIP_URL);
  });

  it("keeps the session when duplicates and missing files are excluded", async () => {
    const showEntry = vi.fn();
    const request = vi.fn(async () => ({ body: { added: [] }, status: 201 }));
    const getState = () => ({
      ownership: { url: OWNERSHIP_URL },
      status: "running" as const,
    });

    await expect(
      addHtmlFiles(["/tmp/duplicate.html", "/tmp/missing.html"], {
        getState,
        inspectSession,
        preparePaths,
        request,
        showEntry,
      }),
    ).resolves.toEqual({ status: "unchanged" });
    expect(showEntry).not.toHaveBeenCalled();
  });

  it("distinguishes a stopped server from an uncertain submitted request", async () => {
    const stoppedState = () => ({ status: "idle" as const });
    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: stoppedState,
        inspectSession,
        preparePaths,
        request: vi.fn(),
        showEntry: vi.fn(),
      }),
    ).resolves.toEqual({ status: "server-stopped" });

    const runningState = () => ({
      ownership: { url: OWNERSHIP_URL },
      status: "running" as const,
    });
    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: runningState,
        inspectSession,
        preparePaths,
        request: vi.fn(async () => {
          throw new Error("request failed");
        }),
        showEntry: vi.fn(),
      }),
    ).resolves.toEqual({ serverStopped: false, status: "unknown" });
  });

  it("does not navigate when ownership changes while adding", async () => {
    let state = {
      ownership: { url: OWNERSHIP_URL },
      status: "running" as "idle" | "running",
    };
    const showEntry = vi.fn();
    const request = vi.fn(async () => {
      state = { ownership: { url: OWNERSHIP_URL }, status: "idle" };
      return { body: { added: [{ id: "first" }] }, status: 201 };
    });

    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: () => state,
        inspectSession,
        preparePaths,
        request,
        showEntry,
      }),
    ).resolves.toEqual({
      addedCount: 1,
      display: "server-stopped",
      status: "added",
    });
    expect(showEntry).not.toHaveBeenCalled();
  });

  it("rejects malformed server responses without exposing path data", async () => {
    const result = await addHtmlFiles(["/private/secret/page.html"], {
      getState: () => ({
        ownership: { url: OWNERSHIP_URL },
        status: "running",
      }),
      inspectSession,
      preparePaths,
      request: vi.fn(async () => ({
        body: { added: [{ id: "" }] },
        status: 201,
      })),
      showEntry: vi.fn(),
    });

    expect(result).toEqual({ serverStopped: false, status: "unknown" });
    expect(JSON.stringify(result)).not.toContain("/private/secret");
  });

  it("keeps an add success when displaying the first entry fails", async () => {
    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: () => ({
          ownership: { url: OWNERSHIP_URL },
          status: "running",
        }),
        inspectSession,
        preparePaths,
        request: vi.fn(async () => ({
          body: { added: [{ id: "first" }] },
          status: 201,
        })),
        showEntry: vi.fn(async () => {
          throw new Error("navigation failed");
        }),
      }),
    ).resolves.toEqual({
      addedCount: 1,
      display: "failed",
      status: "added",
    });
  });

  it("reconciles an interrupted response with the owned session", async () => {
    const inspect = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ absPath: "/tmp/page.html", id: "reconciled" }]);
    const showEntry = vi.fn(async () => undefined);

    await expect(
      addHtmlFiles(["/tmp/page.html"], {
        getState: () => ({
          ownership: { url: OWNERSHIP_URL },
          status: "running",
        }),
        inspectSession: inspect,
        preparePaths,
        request: vi.fn(async () => {
          throw new Error("response interrupted");
        }),
        showEntry,
      }),
    ).resolves.toEqual({
      addedCount: 1,
      display: "shown",
      status: "added",
    });
    expect(showEntry).toHaveBeenCalledWith("reconciled", OWNERSHIP_URL);
  });
});
