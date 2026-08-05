import type { ZattoHealthIdentity } from "./zatto-server-contract";
import { validateZattoHealthIdentity } from "./zatto-server-contract";
import { toZattoServerError, ZattoServerError } from "./zatto-server-errors";
import { withLifecycleTimeout } from "./zatto-server-lifecycle-io";
import type {
  OwnedRuntimeRecord,
  OwnedZattoServer,
  ZattoServerManagerOptions,
  ZattoServerResponse,
} from "./zatto-server-manager-types";

/**
 * Requests and validates the health identity of an owned zatto server.
 *
 * @param options - Manager deadlines and HTTP adapter
 * @param runtimeRecord - Runtime identity written by the child
 * @param url - Loopback origin assigned to the child
 * @returns Compatible zatto health identity
 * @throws ZattoServerError when health is unreachable or incompatible
 */
export async function requestCompatibleZattoHealth(
  options: ZattoServerManagerOptions,
  runtimeRecord: OwnedRuntimeRecord,
  url: string,
): Promise<ZattoHealthIdentity> {
  let response: ZattoServerResponse;
  try {
    response = await withLifecycleTimeout(
      options.dependencies.requestHealth(`${url}/api/health`),
      options.startupTimeoutMs,
      () =>
        new ZattoServerError(
          "HEALTH_UNREACHABLE",
          "zatto health request timed out",
        ),
    );
  } catch (error) {
    throw toZattoServerError(
      error,
      "HEALTH_UNREACHABLE",
      "zatto health endpoint is unreachable",
    );
  }
  if (response.status !== 200) {
    throw new ZattoServerError(
      "HEALTH_UNREACHABLE",
      `zatto health request returned HTTP ${response.status}`,
    );
  }
  try {
    return validateZattoHealthIdentity(response.body, runtimeRecord);
  } catch (error) {
    throw new ZattoServerError(
      "HEALTH_INCOMPATIBLE",
      "zatto health identity is incompatible",
      error,
    );
  }
}

/**
 * Terminates the retained child after startup validation fails.
 *
 * @param child - Retained child handle
 * @param timeoutMs - Maximum fallback duration
 * @param startupError - Startup failure preserved as the cause
 * @returns Promise resolved after the retained child exits
 * @throws ZattoServerError when fallback termination fails
 */
export async function cleanupFailedZattoStartup(
  child: OwnedZattoServer,
  timeoutMs: number,
  startupError: unknown,
): Promise<void> {
  if (child.exitCode !== undefined) return;
  if (!child.process.kill()) {
    throw new ZattoServerError(
      "STARTUP_CLEANUP_FAILURE",
      "zatto utility process rejected startup cleanup",
      startupError,
    );
  }
  try {
    await withLifecycleTimeout(
      child.process.exit,
      timeoutMs,
      () =>
        new ZattoServerError(
          "STARTUP_CLEANUP_FAILURE",
          "zatto utility process startup cleanup timed out",
          startupError,
        ),
    );
  } catch (error) {
    throw toZattoServerError(
      error,
      "STARTUP_CLEANUP_FAILURE",
      "zatto utility process startup cleanup failed",
    );
  }
}
