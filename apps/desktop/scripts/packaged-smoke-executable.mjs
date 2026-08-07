import path from "node:path";
import {
  resolveDebianPackagePath,
  withExtractedDebianPackage,
} from "./debian-package.mjs";
import { resolvePackagedAppPaths } from "./packaged-app-paths.mjs";

const defaultDependencies = {
  resolveDebianPackagePath,
  resolvePackagedAppPaths,
  withExtractedDebianPackage,
};

/**
 * Runs a smoke operation against the installed executable for a Forge artifact.
 *
 * @template T
 * @param {{ architecture: string; outputDirectory: string; platform: NodeJS.Platform; version: string }} options - Artifact identity
 * @param {(executablePath: string) => Promise<T>} operation - Smoke operation
 * @param {object} dependencies - Package resolution and extraction adapters
 * @returns {Promise<T>} Smoke operation result
 * @throws {Error} When artifact resolution, extraction, or the operation fails
 */
export async function withPackagedSmokeExecutable(
  options,
  operation,
  dependencies = defaultDependencies,
) {
  if (options.platform === "linux") {
    const packagePath = await dependencies.resolveDebianPackagePath(
      options.outputDirectory,
      options.version,
      options.architecture,
    );
    return dependencies.withExtractedDebianPackage(
      packagePath,
      async (directory) =>
        operation(path.join(directory, "usr", "lib", "zatto", "zatto")),
    );
  }
  const { executablePath } = await dependencies.resolvePackagedAppPaths(
    options.outputDirectory,
    options.platform,
    options.architecture,
  );
  return operation(executablePath);
}
