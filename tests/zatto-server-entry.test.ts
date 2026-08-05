import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveZattoServerEntry } from "../src/main/zatto-server-entry";

describe("resolveZattoServerEntry", () => {
  it("resolves the package-internal server entry below the application root", () => {
    const appPath = path.join(
      path.parse(process.cwd()).root,
      "Applications",
      "Zatto Desktop.app",
      "Contents",
      "Resources",
      "app.asar",
    );

    expect(resolveZattoServerEntry(appPath)).toBe(
      path.join(
        appPath,
        "node_modules",
        "@yuske-nakajima",
        "zatto",
        "dist",
        "server",
        "index.js",
      ),
    );
  });
});
