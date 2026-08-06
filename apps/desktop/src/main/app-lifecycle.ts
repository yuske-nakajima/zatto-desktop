import { ZattoServerError } from "./zatto-server-errors";

/** Event contract needed to defer Electron application shutdown. */
export interface AppQuitEvent {
  preventDefault: () => void;
}

/** Operations used by the guarded zatto server quit handler. */
export interface ZattoServerQuitDependencies {
  quit: () => void;
  reportError: (error: unknown) => void;
  stop: () => Promise<void>;
}

/** Operations that flush window state before stopping the owned server. */
export interface StateFlushingStopDependencies {
  flushState: () => Promise<void>;
  reportStateError: (error: unknown) => void;
  stopServer: () => Promise<void>;
}

/**
 * Creates a stop operation that cannot be blocked by state persistence failure.
 *
 * @param dependencies - State flush, error reporting, and server stop operations
 * @returns Operation that flushes state and then stops the server
 */
export function createStateFlushingStop(
  dependencies: StateFlushingStopDependencies,
): () => Promise<void> {
  return async () => {
    try {
      await dependencies.flushState();
    } catch (error) {
      try {
        dependencies.reportStateError(error);
      } catch {
        // Error reporting must not supersede owned-process cleanup.
      }
    }
    await dependencies.stopServer();
  };
}

function isOwnedChildCleanupFailure(error: unknown): boolean {
  return (
    !(error instanceof ZattoServerError) ||
    error.code === "STARTUP_CLEANUP_FAILURE" ||
    error.code === "SHUTDOWN_KILL_FAILURE"
  );
}

/**
 * Creates a reentrancy-safe handler that stops zatto before application exit.
 *
 * @param dependencies - Server stop, error reporting, and final quit operations
 * @returns Handler for Electron's `before-quit` event
 */
export function createZattoServerQuitHandler(
  dependencies: ZattoServerQuitDependencies,
): (event: AppQuitEvent) => void {
  let quitAllowed = false;
  let stopPromise: Promise<void> | undefined;
  const finishQuit = () => {
    quitAllowed = true;
    dependencies.quit();
  };

  return (event) => {
    if (quitAllowed) return;
    event.preventDefault();
    if (stopPromise) return;
    stopPromise = Promise.resolve()
      .then(dependencies.stop)
      .then(finishQuit, (error: unknown) => {
        dependencies.reportError(error);
        if (isOwnedChildCleanupFailure(error)) {
          stopPromise = undefined;
          return;
        }
        finishQuit();
      });
  };
}
