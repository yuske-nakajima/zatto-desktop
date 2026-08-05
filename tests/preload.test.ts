import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("preload", () => {
  it("uses restricted drop IPC without exposing renderer APIs", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/preload/index.ts"),
      "utf8",
    );

    expect(source).not.toContain("contextBridge");
    expect(source).toContain("webUtils.getPathForFile");
    expect(source).toContain("ipcRenderer.send");
    expect(source).not.toContain("window.");
  });
});
