import { describe, expect, it, vi } from "vitest";

import { showAddedHtmlEntry } from "../src/main/html-file-navigation";

describe("showAddedHtmlEntry", () => {
  it("selects the first added entry on the owned origin", async () => {
    const window = {
      isDestroyed: () => false,
      loadURL: vi.fn(async () => undefined),
    };
    await showAddedHtmlEntry(
      window,
      {
        ownership: { url: "http://127.0.0.1:49152/" },
        status: "running",
      },
      "entry / 日本語",
      "http://127.0.0.1:49152/",
    );
    expect(window.loadURL).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/?entry=entry+%2F+%E6%97%A5%E6%9C%AC%E8%AA%9E",
    );
  });

  it("rejects stale ownership and destroyed windows", async () => {
    await expect(
      showAddedHtmlEntry(
        { isDestroyed: () => true, loadURL: vi.fn() },
        { status: "idle" },
        "entry",
        "http://127.0.0.1:49152/",
      ),
    ).rejects.toThrow("unavailable");
  });
});
