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
