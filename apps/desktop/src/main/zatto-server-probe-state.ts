import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Creates an isolated user-data root for a zatto server smoke probe.
 *
 * @param userDataPath - Electron application user-data directory
 * @returns Unique probe root below the application user-data directory
 */
export async function createZattoServerProbeUserDataRoot(
  userDataPath: string,
): Promise<string> {
  const probeRoot = path.join(userDataPath, "zatto-server-probes");
  await mkdir(probeRoot, { mode: 0o700, recursive: true });
  return mkdtemp(path.join(probeRoot, "probe-"));
}

/**
 * Removes an isolated probe root after its owned child has stopped.
 *
 * @param probeUserDataPath - Unique path returned by the probe-root creator
 * @returns Promise resolved after probe state removal
 */
export function removeZattoServerProbeUserDataRoot(
  probeUserDataPath: string,
): Promise<void> {
  return rm(probeUserDataPath, { force: true, recursive: true });
}
