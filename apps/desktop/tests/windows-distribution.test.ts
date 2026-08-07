import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWindowsMakerConfig } from "../windows-maker-config";
import { findRepositoryRoot } from "./repository-root";

const repositoryRoot = findRepositoryRoot();
const repositoryFile = (relativePath: string) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

describe("Windows distribution", () => {
  it("uses zatto product metadata and icons in the Squirrel installer", () => {
    const setupIcon = path.resolve("assets/icons/zatto-desktop.ico");

    expect(resolveWindowsMakerConfig(setupIcon)).toEqual({
      authors: "yusuke nakajima",
      description: "View local HTML files together with zatto.",
      exe: "zatto.exe",
      iconUrl:
        "https://raw.githubusercontent.com/yuske-nakajima/zatto-desktop/24ec9e9c37a731d8d15b9067dcaf22aaddc1e91f/apps/desktop/assets/icons/zatto-desktop.ico",
      name: "zatto",
      noMsi: true,
      setupExe: "zatto-Setup.exe",
      setupIcon,
      title: "zatto",
    });
  });

  it("leaves shutdown to the Squirrel shortcut handler", async () => {
    const [packageMetadata, mainSource] = await Promise.all([
      repositoryFile("apps/desktop/package.json"),
      repositoryFile("apps/desktop/src/main/index.ts"),
    ]);

    expect(JSON.parse(packageMetadata).dependencies).toHaveProperty(
      "electron-squirrel-startup",
      "1.0.1",
    );
    expect(mainSource).toContain('from "electron-squirrel-startup"');
    expect(mainSource).not.toContain("if (isSquirrelStartup) app.quit();");
  });

  it("runs the complete desktop verification on macOS and Windows", async () => {
    const workflow = await repositoryFile(".github/workflows/ci.yml");

    expect(workflow).toContain("os: [macos-14, windows-2025]");
    expect(workflow).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm smoke:dev");
    expect(workflow).toContain("pnpm make");
    expect(workflow).toContain("pnpm smoke:packaged");
    expect(workflow).toContain("zatto-windows-installer");
    expect(workflow).toContain("zatto-Setup.exe");
  });

  it("documents installation and unsigned installer guidance", async () => {
    const [englishReadme, japaneseReadme] = await Promise.all([
      repositoryFile("README.md"),
      repositoryFile("README.ja.md"),
    ]);

    for (const readme of [englishReadme, japaneseReadme]) {
      expect(readme).toContain("zatto-Setup.exe");
      expect(readme).toContain("SmartScreen");
    }
  });
});
