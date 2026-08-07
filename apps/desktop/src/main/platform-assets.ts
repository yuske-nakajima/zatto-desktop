import path from "node:path";

const iconExtensions: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "icns",
  linux: "png",
  win32: "ico",
};

/**
 * Resolves the application icon format required by a desktop platform.
 *
 * @param iconBasePath - Icon path without a platform extension
 * @param platform - Node.js platform identifier
 * @returns Path containing the platform-specific icon extension
 * @throws When the platform has no desktop distribution
 */
export function resolvePlatformIconPath(
  iconBasePath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const extension = iconExtensions[platform];
  if (extension === undefined) {
    throw new Error(`Unsupported desktop platform: ${platform}`);
  }
  return path.normalize(`${iconBasePath}.${extension}`);
}
