import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePackagedAppPaths } from "../scripts/packaged-app-paths.mjs";

describe("resolvePackagedAppPaths", () => {
  const temporaryDirectories = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, {
          force: true,
          recursive: true,
        }),
      ),
    );
  });

  it.each([
    [
      "darwin",
      "arm64",
      "zatto-darwin-arm64/zatto.app/Contents/Resources/app.asar",
      "zatto-darwin-arm64/zatto.app/Contents/MacOS/zatto",
      "zatto-darwin-arm64/zatto.app/Contents/Resources/electron.icns",
    ],
    [
      "win32",
      "x64",
      "zatto-win32-x64/resources/app.asar",
      "zatto-win32-x64/zatto.exe",
      undefined,
    ],
    [
      "linux",
      "x64",
      "zatto-linux-x64/resources/app.asar",
      "zatto-linux-x64/zatto",
      undefined,
    ],
  ])(
    "resolves %s artifacts",
    async (platform, architecture, archive, executable, icon) => {
      const outputDirectory = await mkdtemp(
        path.join(tmpdir(), "zatto-output-"),
      );
      temporaryDirectories.push(outputDirectory);
      await mkdir(
        path.join(outputDirectory, `zatto-${platform}-${architecture}`),
      );

      await expect(
        resolvePackagedAppPaths(outputDirectory, platform, architecture),
      ).resolves.toEqual({
        archivePath: path.join(outputDirectory, archive),
        executablePath: path.join(outputDirectory, executable),
        iconPath:
          icon === undefined ? undefined : path.join(outputDirectory, icon),
      });
    },
  );

  it("rejects unsupported desktop platforms", async () => {
    await expect(
      resolvePackagedAppPaths("out", "aix", "ppc64"),
    ).rejects.toThrow("Unsupported desktop platform: aix");
  });
});
