import path from "node:path";

/**
 * Resolves zatto's package-internal server entry from an Electron application root.
 *
 * @param appPath - Value returned by Electron's `app.getAppPath()`
 * @returns Absolute path to zatto's server entry inside the application
 */
export function resolveZattoServerEntry(appPath: string): string {
  return path.join(
    appPath,
    "node_modules",
    "@yuske-nakajima",
    "zatto",
    "dist",
    "server",
    "index.js",
  );
}
