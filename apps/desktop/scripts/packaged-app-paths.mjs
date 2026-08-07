import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Resolves the single desktop application produced by Electron Forge.
 *
 * @param {string} outputDirectory - Forge output directory
 * @param {NodeJS.Platform} platform - Target platform
 * @param {string} architecture - Target architecture
 * @returns {Promise<{ archivePath: string; executablePath: string; iconPath: string | undefined }>} Packaged application paths
 * @throws {Error} When the output directory does not contain exactly one application
 */
export async function resolvePackagedAppPaths(
  outputDirectory = path.resolve("out"),
  platform = process.platform,
  architecture = process.arch,
) {
  const layout = resolvePackagedLayout(platform);
  const outputName = `zatto-${platform}-${architecture}`;
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const packageDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name === outputName)
    .map((entry) => path.join(outputDirectory, entry.name));

  if (packageDirectories.length !== 1) {
    throw new Error(
      `Expected one packaged zatto application for ${platform}-${architecture}, found ${packageDirectories.length}`,
    );
  }

  const packageDirectory = packageDirectories[0];
  const applicationDirectory = layout.bundleDirectory
    ? path.join(packageDirectory, layout.bundleDirectory)
    : packageDirectory;
  return {
    archivePath: path.join(applicationDirectory, ...layout.archiveParts),
    executablePath: path.join(applicationDirectory, ...layout.executableParts),
    iconPath:
      layout.iconParts === undefined
        ? undefined
        : path.join(applicationDirectory, ...layout.iconParts),
  };
}

function resolvePackagedLayout(platform) {
  if (platform === "darwin") {
    return {
      archiveParts: ["Contents", "Resources", "app.asar"],
      bundleDirectory: "zatto.app",
      executableParts: ["Contents", "MacOS", "zatto"],
      iconParts: ["Contents", "Resources", "electron.icns"],
    };
  }
  if (platform === "win32") {
    return {
      archiveParts: ["resources", "app.asar"],
      executableParts: ["zatto.exe"],
    };
  }
  if (platform === "linux") {
    return {
      archiveParts: ["resources", "app.asar"],
      executableParts: ["zatto"],
    };
  }
  throw new Error(`Unsupported desktop platform: ${platform}`);
}
