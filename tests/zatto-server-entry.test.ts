import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveZattoServerEntry } from "../src/main/zatto-server-entry";

describe("resolveZattoServerEntry", () => {
  const temporaryDirectories: string[] = [];

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

  it("resolves the server entry through the package export", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "zatto desktop entry "),
    );
    temporaryDirectories.push(temporaryDirectory);
    const packageDirectory = path.join(
      temporaryDirectory,
      "node_modules",
      "@yuske-nakajima",
      "zatto",
    );
    const serverEntry = path.join(packageDirectory, "public", "server.mjs");
    await mkdir(path.dirname(serverEntry), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(packageDirectory, "package.json"),
        `${JSON.stringify({
          exports: {
            "./server": "./public/server.mjs",
          },
          name: "@yuske-nakajima/zatto",
          type: "module",
        })}\n`,
      ),
      writeFile(serverEntry, "export {};\n"),
    ]);

    expect(resolveZattoServerEntry(temporaryDirectory)).toBe(
      await realpath(serverEntry),
    );
  });

  it("rejects a package without the public server export", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "zatto desktop missing export "),
    );
    temporaryDirectories.push(temporaryDirectory);
    const packageDirectory = path.join(
      temporaryDirectory,
      "node_modules",
      "@yuske-nakajima",
      "zatto",
    );
    const privateServerEntry = path.join(
      packageDirectory,
      "dist",
      "server",
      "index.js",
    );
    await mkdir(path.dirname(privateServerEntry), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(packageDirectory, "package.json"),
        `${JSON.stringify({
          exports: {
            "./package.json": "./package.json",
          },
          name: "@yuske-nakajima/zatto",
          type: "module",
        })}\n`,
      ),
      writeFile(privateServerEntry, "export {};\n"),
    ]);

    expect(() => resolveZattoServerEntry(temporaryDirectory)).toThrow(
      "Package subpath './server' is not defined by \"exports\"",
    );
  });
});
