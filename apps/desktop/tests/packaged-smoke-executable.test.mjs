import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withPackagedSmokeExecutable } from "../scripts/packaged-smoke-executable.mjs";

describe("withPackagedSmokeExecutable", () => {
  it("runs Linux smoke operations against the executable extracted from the deb", async () => {
    const operation = vi.fn(async () => "passed");
    const dependencies = {
      resolveDebianPackagePath: vi.fn(async () => "/out/zatto.deb"),
      resolvePackagedAppPaths: vi.fn(),
      withExtractedDebianPackage: vi.fn(async (_packagePath, callback) =>
        callback("/temporary/debian"),
      ),
    };

    await expect(
      withPackagedSmokeExecutable(
        {
          architecture: "x64",
          outputDirectory: "/out",
          platform: "linux",
          version: "0.1.9",
        },
        operation,
        dependencies,
      ),
    ).resolves.toBe("passed");
    expect(dependencies.resolveDebianPackagePath).toHaveBeenCalledWith(
      "/out",
      "0.1.9",
      "x64",
    );
    expect(dependencies.withExtractedDebianPackage).toHaveBeenCalledWith(
      "/out/zatto.deb",
      expect.any(Function),
    );
    expect(operation).toHaveBeenCalledWith(
      path.join("/temporary/debian", "usr", "lib", "zatto", "zatto"),
    );
    expect(dependencies.resolvePackagedAppPaths).not.toHaveBeenCalled();
  });

  it("uses the Forge package directory outside Linux", async () => {
    const operation = vi.fn(async () => "passed");
    const dependencies = {
      resolveDebianPackagePath: vi.fn(),
      resolvePackagedAppPaths: vi.fn(async () => ({
        executablePath: "/out/zatto.app/Contents/MacOS/zatto",
      })),
      withExtractedDebianPackage: vi.fn(),
    };

    await expect(
      withPackagedSmokeExecutable(
        {
          architecture: "arm64",
          outputDirectory: "/out",
          platform: "darwin",
          version: "0.1.9",
        },
        operation,
        dependencies,
      ),
    ).resolves.toBe("passed");
    expect(operation).toHaveBeenCalledWith(
      "/out/zatto.app/Contents/MacOS/zatto",
    );
    expect(dependencies.withExtractedDebianPackage).not.toHaveBeenCalled();
  });
});
