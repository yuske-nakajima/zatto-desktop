import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findRepositoryRoot } from "./repository-root";

const repositoryFile = (relativePath: string) =>
  readFile(path.resolve(relativePath), "utf8");
const repositoryRoot = findRepositoryRoot();
const rootFile = (relativePath: string) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

describe("zatto product name", () => {
  it("uses zatto for the packaged application", async () => {
    const packageMetadata = JSON.parse(await repositoryFile("package.json"));
    const packagedPaths = await repositoryFile(
      "scripts/packaged-app-paths.mjs",
    );

    expect(packageMetadata.productName).toBe("zatto");
    expect(packagedPaths).toContain('entry.name.startsWith("zatto-darwin-")');
    expect(packagedPaths).toContain(
      'path.join(outputDirectory, entry.name, "zatto.app")',
    );
    expect(packagedPaths).toContain('"MacOS",\n      "zatto",');
  });

  it("uses zatto in user-visible application text", async () => {
    const [renderer, errorScreen, workflow] = await Promise.all([
      repositoryFile("src/renderer/index.html"),
      repositoryFile("src/main/window-error-screen.ts"),
      rootFile(".github/workflows/release.yml"),
    ]);

    expect(renderer).toContain("<title>zatto</title>");
    expect(renderer).not.toContain("Zatto Desktop");
    expect(errorScreen).not.toContain("Zatto Desktop");
    expect(workflow).toContain("-name 'zatto.app'");
    expect(workflow).toMatch(
      /--title "zatto \$\{\{ steps\.release\.outputs\.version \}\}"/,
    );
  });
});
