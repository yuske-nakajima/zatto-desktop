import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Resolves the single macOS application produced by Electron Forge.
 *
 * @param {string} outputDirectory - Forge output directory
 * @returns {Promise<{ archivePath: string; executablePath: string }>} Packaged application paths
 * @throws {Error} When the output directory does not contain exactly one application
 */
export async function resolvePackagedAppPaths(
  outputDirectory = path.resolve("out"),
) {
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const applicationDirectories = entries
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith("Zatto Desktop-darwin-"),
    )
    .map((entry) =>
      path.join(outputDirectory, entry.name, "Zatto Desktop.app"),
    );

  if (applicationDirectories.length !== 1) {
    throw new Error(
      `Expected one packaged Zatto Desktop application, found ${applicationDirectories.length}`,
    );
  }

  const applicationDirectory = applicationDirectories[0];
  return {
    archivePath: path.join(
      applicationDirectory,
      "Contents",
      "Resources",
      "app.asar",
    ),
    executablePath: path.join(
      applicationDirectory,
      "Contents",
      "MacOS",
      "Zatto Desktop",
    ),
  };
}
