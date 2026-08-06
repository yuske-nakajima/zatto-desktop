import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findRepositoryRoot } from "./repository-root";

const repositoryRoot = findRepositoryRoot();
const readJson = async (relativePath: string) =>
  JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));

describe("workspace layout", () => {
  it("keeps orchestration at the root and the Electron product in apps/desktop", async () => {
    const [rootPackage, desktopPackage] = await Promise.all([
      readJson("package.json"),
      readJson("apps/desktop/package.json"),
    ]);

    expect(rootPackage).toMatchObject({
      name: "zatto-desktop-workspace",
      private: true,
    });
    expect(rootPackage.scripts).toMatchObject({
      check: "pnpm run typecheck && biome check .",
      make: "pnpm --filter zatto-desktop make",
      start: "pnpm --filter zatto-desktop start",
      test: "pnpm --recursive --if-present test",
    });
    expect(desktopPackage).toMatchObject({
      name: "zatto-desktop",
      private: true,
      productName: "zatto",
    });
  });

  it("registers application workspaces", async () => {
    const workspace = await readFile(
      path.join(repositoryRoot, "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(workspace).toContain("  - apps/*");
    expect(workspace).not.toContain("  - .\n");
  });
});
