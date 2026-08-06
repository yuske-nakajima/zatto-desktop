import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("preload", () => {
  it("uses restricted drop IPC without exposing renderer APIs", async () => {
    const source = (
      await Promise.all(
        [
          "index.ts",
          "html-file-drop-shield.ts",
          "html-file-drop-shield-styles.ts",
        ].map((fileName) =>
          readFile(path.join(process.cwd(), "src/preload", fileName), "utf8"),
        ),
      )
    ).join("\n");

    expect(source).not.toContain("contextBridge");
    expect(source).toContain("webUtils.getPathForFile");
    expect(source).toContain("ipcRenderer.send");
    expect(source).toContain("zatto-desktop-drop-shield");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).not.toContain("window.");
  });
});
