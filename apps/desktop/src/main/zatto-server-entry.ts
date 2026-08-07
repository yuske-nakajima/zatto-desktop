import * as nodeModule from "node:module";
import path from "node:path";

/**
 * Resolves zatto's public server entry from an Electron application root.
 *
 * @param appPath - Value returned by Electron's `app.getAppPath()`
 * @returns Absolute path exported by `@yuske-nakajima/zatto/server`
 * @throws When the application does not contain zatto's public server export
 */
export function resolveZattoServerEntry(appPath: string): string {
  const zattoRequire = nodeModule.createRequire(
    path.join(appPath, "package.json"),
  );
  return zattoRequire.resolve("@yuske-nakajima/zatto/server");
}
