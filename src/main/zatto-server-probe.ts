import {
  runZattoServerProbeLifecycle,
  type ZattoServerProbeResult,
} from "./zatto-server-probe-runner";
import {
  createZattoServerProbeUserDataRoot,
  removeZattoServerProbeUserDataRoot,
} from "./zatto-server-probe-state";
import { createElectronZattoServerManager } from "./zatto-server-process";

export type { ZattoServerProbeResult } from "./zatto-server-probe-runner";

/**
 * Starts, identifies, and stops the bundled zatto server.
 *
 * @param appPath - Electron application root containing production dependencies
 * @param userDataPath - Electron user-data root for isolated probe state
 * @returns Observed server identity and cleanup state
 * @throws Error when startup, identity validation, or cleanup fails
 */
export async function runZattoServerProbe(
  appPath: string,
  userDataPath: string,
): Promise<ZattoServerProbeResult> {
  return runZattoServerProbeLifecycle({
    createManager: (probeUserDataPath) =>
      createElectronZattoServerManager(appPath, probeUserDataPath),
    createProbeUserDataRoot: () =>
      createZattoServerProbeUserDataRoot(userDataPath),
    removeProbeUserDataRoot: removeZattoServerProbeUserDataRoot,
  });
}
