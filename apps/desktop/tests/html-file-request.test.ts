import { describe, expect, it, vi } from "vitest";

import {
  inspectHtmlFileSession,
  requestHtmlFileAdd,
} from "../src/main/html-file-request";

const RPC_URL = "http://127.0.0.1:49152/rpc";

function rpcResponse(result: unknown) {
  return {
    json: async () => ({ id: 1, jsonrpc: "2.0", result }),
    ok: true,
    status: 200,
  };
}

describe("requestHtmlFileAdd", () => {
  it("refuses redirects and adds to the active workspace", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(rpcResponse({ activeWorkspaceId: "workspace-1" }))
      .mockResolvedValueOnce(rpcResponse({ added: [] }));
    vi.stubGlobal("fetch", fetch);

    const response = await requestHtmlFileAdd(
      RPC_URL,
      ["/private/page.html"],
      AbortSignal.timeout(1_000),
    );

    expect(response).toEqual({ body: { added: [] }, status: 201 });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) {
      expect(call[0]).toBe(RPC_URL);
      expect(call[1]).toEqual(
        expect.objectContaining({ method: "POST", redirect: "error" }),
      );
    }
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toMatchObject({
      method: "session.add",
      params: { paths: ["/private/page.html"], workspaceId: "workspace-1" },
    });
  });
});

describe("inspectHtmlFileSession", () => {
  it("refuses redirects while reconciling an interrupted add", async () => {
    const fetch = vi.fn(async () => rpcResponse({ entries: [] }));
    vi.stubGlobal("fetch", fetch);

    await inspectHtmlFileSession(
      "http://127.0.0.1:49152/",
      AbortSignal.timeout(1_000),
    );

    expect(fetch).toHaveBeenCalledWith(
      RPC_URL,
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
  });
});
