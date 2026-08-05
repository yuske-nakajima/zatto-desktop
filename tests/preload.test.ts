import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("preload", () => {
  it("does not expose renderer APIs", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/preload/index.ts"),
      "utf8",
    );

    expect(source.trim()).toBe("export {};");
    expect(source).not.toContain("contextBridge");
    expect(source).not.toContain("ipcRenderer");
  });
});
