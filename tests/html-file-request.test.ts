import { describe, expect, it, vi } from "vitest";

import {
  inspectHtmlFileSession,
  requestHtmlFileAdd,
} from "../src/main/html-file-request";

describe("requestHtmlFileAdd", () => {
  it("refuses redirects for path-bearing POST requests", async () => {
    const fetch = vi.fn(async () => ({
      json: async () => ({ added: [] }),
      status: 201,
    }));
    vi.stubGlobal("fetch", fetch);

    await requestHtmlFileAdd(
      "http://127.0.0.1:49152/api/session/add",
      ["/private/page.html"],
      AbortSignal.timeout(1_000),
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/api/session/add",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
  });
});

describe("inspectHtmlFileSession", () => {
  it("refuses redirects while reconciling an interrupted add", async () => {
    const fetch = vi.fn(async () => ({
      json: async () => ({ entries: [] }),
      status: 200,
    }));
    vi.stubGlobal("fetch", fetch);

    await inspectHtmlFileSession(
      "http://127.0.0.1:49152/",
      AbortSignal.timeout(1_000),
    );

    expect(fetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:49152/api/session"),
      expect.objectContaining({ redirect: "error" }),
    );
  });
});
