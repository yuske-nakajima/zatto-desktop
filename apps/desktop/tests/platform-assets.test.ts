import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePlatformIconPath } from "../src/main/platform-assets";

describe("resolvePlatformIconPath", () => {
  it.each([
    ["darwin", "icns"],
    ["win32", "ico"],
    ["linux", "png"],
  ] as const)("uses the %s icon format", (platform, extension) => {
    expect(resolvePlatformIconPath("assets/icons/zatto", platform)).toBe(
      path.normalize(`assets/icons/zatto.${extension}`),
    );
  });

  it("rejects unsupported desktop platforms", () => {
    expect(() => resolvePlatformIconPath("icon", "aix")).toThrow(
      "Unsupported desktop platform: aix",
    );
  });
});
