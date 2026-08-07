import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function readRepositoryFile(path) {
  return readFile(resolve(REPOSITORY_ROOT, path), "utf8");
}

describe("product site workspace integration", () => {
  it("exposes site commands from the workspace root", async () => {
    const packageJson = JSON.parse(await readRepositoryFile("package.json"));

    expect(packageJson.scripts).toMatchObject({
      "site:dev": "pnpm --filter zatto-site dev",
      "site:build": "pnpm --filter zatto-site build",
      "site:check": "pnpm --filter zatto-site check",
    });
    expect(packageJson.scripts.test).toBe("pnpm --recursive --if-present test");
  });

  it("checks and builds the static site on a Linux CI runner", async () => {
    const workflow = await readRepositoryFile(".github/workflows/ci.yml");

    expect(workflow).toContain("site:");
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("pnpm site:check");
    expect(workflow).toContain("pnpm site:build");
    expect(workflow).toContain("apps/site/dist/ja/index.html");
    expect(workflow).toContain("apps/site/dist/assets");
  });

  it("documents the site workspace and commands in both readmes", async () => {
    const readmes = await Promise.all([
      readRepositoryFile("README.md"),
      readRepositoryFile("README.ja.md"),
    ]);

    for (const readme of readmes) {
      expect(readme).toContain("`apps/site`");
      expect(readme).toContain("`pnpm site:dev`");
      expect(readme).toContain("`pnpm site:check`");
      expect(readme).toContain("`pnpm site:build`");
    }
  });
});
