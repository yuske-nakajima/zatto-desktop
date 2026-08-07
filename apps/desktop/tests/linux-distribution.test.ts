import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLinuxMakerConfig } from "../linux-maker-config";
import { findRepositoryRoot } from "./repository-root";

const repositoryRoot = findRepositoryRoot();
const repositoryFile = (relativePath: string) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

describe("Linux distribution", () => {
  it("uses zatto metadata and the PNG icon in the Debian package", () => {
    const icon = path.resolve("assets/icons/zatto-desktop.png");

    expect(resolveLinuxMakerConfig(icon)).toEqual({
      options: {
        bin: "zatto",
        categories: ["Utility"],
        description: "Desktop shell for zatto",
        homepage: "https://github.com/yuske-nakajima/zatto-desktop",
        icon,
        maintainer: "yusuke nakajima",
        name: "zatto",
        productDescription: "View local HTML files together with zatto.",
        productName: "zatto",
        section: "utils",
      },
    });
  });

  it("runs every desktop verification on Ubuntu under a virtual display", async () => {
    const workflow = await repositoryFile(".github/workflows/ci.yml");

    expect(workflow).toContain("os: [macos-14, ubuntu-24.04, windows-2025]");
    expect(workflow).toContain("fakeroot xvfb xauth");
    expect(workflow).toContain("xvfb-run --auto-servernum pnpm smoke:dev");
    expect(workflow).toContain("xvfb-run --auto-servernum pnpm make");
    expect(workflow).toContain("xvfb-run --auto-servernum pnpm smoke:packaged");
    expect(workflow).toContain("Install Linux Debian package");
    expect(workflow).toContain(
      "packages=(apps/desktop/out/make/deb/x64/zatto_*.deb)",
    );
    expect(workflow).toContain("$" + "{#packages[@]} != 1");
    expect(workflow).toContain(
      'sudo apt-get install --yes "./' + "$" + '{packages[0]}"',
    );
    expect(workflow).toContain("ZATTO_LINUX_EXECUTABLE_PATH: /usr/bin/zatto");
    expect(workflow).toContain("always() && runner.os == 'Linux'");
    expect(workflow).toContain("sudo apt-get remove --yes zatto");
    expect(workflow).toContain("zatto-linux-deb");
    expect(workflow).toContain("apps/desktop/out/make/deb/x64/zatto_*.deb");
  });

  it("closes a loaded Linux window from the packaged Debian application", async () => {
    const [packageMetadata, mainSource, smokeSource] = await Promise.all([
      repositoryFile("apps/desktop/package.json"),
      repositoryFile("apps/desktop/src/main/index.ts"),
      repositoryFile("apps/desktop/scripts/run-packaged-smoke.mjs"),
    ]);

    expect(JSON.parse(packageMetadata).scripts).not.toHaveProperty(
      "smoke:window",
    );
    expect(mainSource).toContain('"--smoke-test-window-lifecycle"');
    expect(mainSource).toContain('result !== "running"');
    expect(mainSource).toContain("activeWindow.close()");
    expect(smokeSource).toContain('"--smoke-test-zatto-server"');
    expect(smokeSource).toContain('"--smoke-test-window-lifecycle"');
    expect(smokeSource).toContain('process.platform === "linux"');
    expect(smokeSource).toContain(
      "linuxExecutablePath: process.env.ZATTO_LINUX_EXECUTABLE_PATH",
    );
  });

  it("documents Debian installation and removal in both languages", async () => {
    const [englishReadme, japaneseReadme] = await Promise.all([
      repositoryFile("README.md"),
      repositoryFile("README.ja.md"),
    ]);

    for (const readme of [englishReadme, japaneseReadme]) {
      expect(readme).toContain("zatto-linux-deb");
      expect(readme.match(/```bash/g)).toHaveLength(2);
      expect(readme.match(/shopt -s nullglob/g)).toHaveLength(2);
      expect(readme.match(/packages=\(zatto_\*_amd64\.deb\)/g)).toHaveLength(2);
      expect(readme.match(/\$\{#packages\[@\]\} == 1/g)).toHaveLength(2);
      expect(
        readme.match(/PACKAGE_PATH="\.\/\$\{packages\[0\]\}"/g),
      ).toHaveLength(2);
      expect(readme).toContain('sudo apt install "$PACKAGE_PATH"');
      expect(readme).toContain("sudo apt remove zatto");
      expect(readme).toContain('sudo dpkg -i "$PACKAGE_PATH"');
      expect(readme).not.toContain("zatto_0.1.9_amd64.deb");
    }
  });
});
