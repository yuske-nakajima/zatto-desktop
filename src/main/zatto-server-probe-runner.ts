import type { ZattoHealthIdentity } from "./zatto-server-contract";
import type { ZattoServerOwnership } from "./zatto-server-manager";

/** Result emitted by the zatto utility-process smoke test. */
export interface ZattoServerProbeResult {
  health: ZattoHealthIdentity;
  lockReleased: boolean;
  port: number;
  runtimeRecordReleased: boolean;
}

/** Server operations required by the smoke probe runner. */
export interface ZattoServerProbeManager {
  start: () => Promise<ZattoServerOwnership>;
  stop: () => Promise<void>;
}

/** Isolated state and manager adapters required by the smoke probe. */
export interface ZattoServerProbeDependencies {
  createManager: (probeUserDataPath: string) => ZattoServerProbeManager;
  createProbeUserDataRoot: () => Promise<string>;
  removeProbeUserDataRoot: (probeUserDataPath: string) => Promise<void>;
}

/**
 * Runs the shared manager lifecycle against isolated probe state.
 *
 * @param dependencies - Temporary state and manager adapters
 * @returns Observed server identity and cleanup state
 * @throws Error from startup, shutdown, or isolated-state cleanup
 */
export async function runZattoServerProbeLifecycle(
  dependencies: ZattoServerProbeDependencies,
): Promise<ZattoServerProbeResult> {
  const probeUserDataPath = await dependencies.createProbeUserDataRoot();
  const manager = dependencies.createManager(probeUserDataPath);
  const ownership = await manager.start();
  await manager.stop();
  await dependencies.removeProbeUserDataRoot(probeUserDataPath);
  return {
    health: ownership.health,
    lockReleased: true,
    port: ownership.port,
    runtimeRecordReleased: true,
  };
}
