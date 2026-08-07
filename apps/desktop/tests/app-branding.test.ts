import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const iconDirectory = path.resolve("assets/icons");

describe("application branding", () => {
  it("provides platform icon assets with valid container signatures", async () => {
    const [png, ico, icns] = await Promise.all([
      readFile(path.join(iconDirectory, "zatto-desktop.png")),
      readFile(path.join(iconDirectory, "zatto-desktop.ico")),
      readFile(path.join(iconDirectory, "zatto-desktop.icns")),
    ]);

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(ico.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x00, 0x01, 0x00]));
    expect(icns.subarray(0, 4).toString("ascii")).toBe("icns");
  });

  it("configures Electron Packager to select the platform extension", async () => {
    const forgeConfig = await readFile(path.resolve("forge.config.ts"), "utf8");

    expect(forgeConfig).toContain("icon: resolvePlatformIconPath(");
    expect(forgeConfig).toContain(
      'path.resolve("assets/icons/zatto-desktop"),',
    );
    expect(forgeConfig).toContain("process.platform,");
  });
});
