import { toZattoServerError, ZattoServerError } from "./zatto-server-errors";
import { withLifecycleTimeout } from "./zatto-server-lifecycle-io";
import type {
  OwnedZattoServer,
  ZattoServerManagerOptions,
} from "./zatto-server-manager-types";

const POLL_INTERVAL_MS = 50;

/**
 * Stops a desktop-owned zatto process through its authenticated API.
 *
 * @param child - Retained child and validated ownership data
 * @param options - Manager configuration and adapters
 * @returns Promise resolved after exit and runtime-state release
 * @throws ZattoServerError when graceful or fallback shutdown fails
 */
export async function stopOwnedZattoServer(
  child: OwnedZattoServer,
  options: ZattoServerManagerOptions,
): Promise<void> {
  let shutdownError: ZattoServerError | undefined;
  try {
    const response = await requestShutdown(child, options);
    if (response.status !== 202) {
      throw new ZattoServerError(
        "SHUTDOWN_REJECTED",
        `zatto shutdown request returned HTTP ${response.status}`,
      );
    }
    child.exitCode = await withLifecycleTimeout(
      child.process.exit,
      options.shutdownTimeoutMs,
      () =>
        new ZattoServerError(
          "SHUTDOWN_TIMEOUT",
          "zatto utility process did not exit after shutdown",
        ),
    );
    const exitError =
      child.exitCode === 0
        ? undefined
        : new ZattoServerError(
            "SHUTDOWN_EXIT_FAILURE",
            `zatto utility process exited with code ${child.exitCode}`,
          );
    try {
      if (child.ownsRuntime) {
        await waitForRuntimeRelease(child, options);
      }
    } catch (error) {
      const cleanupError = toZattoServerError(
        error,
        "SHUTDOWN_CLEANUP_FAILURE",
        "zatto runtime cleanup verification failed",
      );
      if (exitError) {
        throw combineExitAndCleanupErrors(exitError, cleanupError);
      }
      throw cleanupError;
    }
    if (exitError) throw exitError;
    return;
  } catch (error) {
    shutdownError = toZattoServerError(
      error,
      "SHUTDOWN_UNREACHABLE",
      "zatto shutdown request failed",
    );
  }

  if (child.exitCode === undefined) {
    await killRetainedChild(child, options, shutdownError);
    if (child.ownsRuntime) {
      await waitForRuntimeRelease(child, options);
    }
  }
  throw shutdownError;
}

function combineExitAndCleanupErrors(
  exitError: ZattoServerError,
  cleanupError: ZattoServerError,
): ZattoServerError {
  const exitWithCleanupCause = new ZattoServerError(
    "SHUTDOWN_EXIT_FAILURE",
    exitError.message,
    cleanupError,
  );
  return new ZattoServerError(
    "SHUTDOWN_CLEANUP_FAILURE",
    cleanupError.message,
    exitWithCleanupCause,
  );
}

async function requestShutdown(
  child: OwnedZattoServer,
  options: ZattoServerManagerOptions,
) {
  try {
    return await withLifecycleTimeout(
      options.dependencies.requestShutdown(
        `${child.ownership.url}/api/shutdown`,
        child.ownership.instanceId,
      ),
      options.shutdownTimeoutMs,
      () =>
        new ZattoServerError(
          "SHUTDOWN_TIMEOUT",
          "zatto shutdown request timed out",
        ),
    );
  } catch (error) {
    throw toZattoServerError(
      error,
      "SHUTDOWN_UNREACHABLE",
      "zatto shutdown endpoint is unreachable",
    );
  }
}

async function waitForRuntimeRelease(
  child: OwnedZattoServer,
  options: ZattoServerManagerOptions,
): Promise<void> {
  const deadline = options.dependencies.now() + options.shutdownTimeoutMs;
  while (options.dependencies.now() < deadline) {
    let runtimeExists: boolean;
    let lockExists: boolean;
    try {
      [runtimeExists, lockExists] = await Promise.all([
        options.dependencies.pathExists(child.ownership.runtimeFile),
        options.dependencies.pathExists(child.ownership.lockDirectory),
      ]);
    } catch (error) {
      throw new ZattoServerError(
        "SHUTDOWN_CLEANUP_FAILURE",
        "zatto runtime state could not be inspected",
        error,
      );
    }
    if (!runtimeExists && !lockExists) return;
    await options.dependencies.wait(POLL_INTERVAL_MS);
  }
  throw new ZattoServerError(
    "SHUTDOWN_CLEANUP_FAILURE",
    "zatto runtime state remained after shutdown",
  );
}

async function killRetainedChild(
  child: OwnedZattoServer,
  options: ZattoServerManagerOptions,
  shutdownError: ZattoServerError,
): Promise<void> {
  if (!child.process.kill()) {
    throw new ZattoServerError(
      "SHUTDOWN_KILL_FAILURE",
      "zatto utility process rejected fallback termination",
      shutdownError,
    );
  }
  try {
    child.exitCode = await withLifecycleTimeout(
      child.process.exit,
      options.shutdownTimeoutMs,
      () =>
        new ZattoServerError(
          "SHUTDOWN_KILL_FAILURE",
          "zatto utility process did not exit after fallback termination",
          shutdownError,
        ),
    );
  } catch (error) {
    throw toZattoServerError(
      error,
      "SHUTDOWN_KILL_FAILURE",
      "zatto fallback termination failed",
    );
  }
}
