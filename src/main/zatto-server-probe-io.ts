import { access, readFile, rm } from "node:fs/promises";
import type { ZattoRuntimeRecord } from "./zatto-server-contract";
import { parseZattoRuntimeRecord } from "./zatto-server-contract";

const POLL_INTERVAL_MS = 50;

/** Operations and state needed to safely clean up a zatto probe. */
export interface ZattoProbeCleanupOptions {
  exitPromise: Promise<number>;
  hasExited: () => boolean;
  kill: () => boolean;
  probeDirectory: string;
  timeoutMs: number;
}

/**
 * Waits for a valid zatto runtime record or an early process exit.
 *
 * @param runtimeFile - Dedicated runtime record path
 * @param timeoutMs - Maximum startup wait in milliseconds
 * @param getExitCode - Reads the utility process exit code when available
 * @returns Validated runtime record
 * @throws Error when the process exits early or startup times out
 */
export async function waitForRuntimeRecord(
  runtimeFile: string,
  timeoutMs: number,
  getExitCode: () => number | undefined,
): Promise<ZattoRuntimeRecord> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value: unknown = JSON.parse(await readFile(runtimeFile, "utf8"));
      return parseZattoRuntimeRecord(value);
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }
    const exitCode = getExitCode();
    if (exitCode !== undefined) {
      throw new Error(
        `zatto utility process exited before startup with code ${exitCode}`,
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("zatto runtime record was not created before timeout");
}

/**
 * Waits for a zatto runtime record or lock directory to disappear.
 *
 * @param targetPath - Runtime state path to observe
 * @param timeoutMs - Maximum cleanup wait in milliseconds
 * @returns Promise that resolves after the path disappears
 * @throws Error when runtime state remains after the timeout
 */
export async function waitForMissing(
  targetPath: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(targetPath);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error("zatto runtime state remained after shutdown");
}

/**
 * Captures a bounded tail from a utility process output stream.
 *
 * @param stream - Piped utility process stream
 * @returns Function that reads the captured output
 */
export function captureStream(
  stream: NodeJS.ReadableStream | null,
): () => string {
  let output = "";
  stream?.on("data", (chunk: Buffer | string) => {
    output = `${output}${chunk.toString()}`.slice(-4096);
  });
  return () => output;
}

/**
 * Rejects a promise when it does not settle before a deadline.
 *
 * @param promise - Operation to observe
 * @param timeoutMs - Deadline in milliseconds
 * @param message - Timeout error message
 * @returns Original promise result
 * @throws Error after the deadline elapses
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Stops a remaining utility process and removes state only after exit confirmation.
 *
 * @param options - Utility-process lifecycle and probe-directory operations
 * @returns Promise that resolves after confirmed exit and state removal
 * @throws Error when the utility process does not exit within the cleanup deadline
 */
export async function cleanupZattoProbeState(
  options: ZattoProbeCleanupOptions,
): Promise<void> {
  if (!options.hasExited()) {
    if (!options.kill()) {
      throw new Error("zatto utility process did not accept cleanup SIGTERM");
    }
    await withTimeout(
      options.exitPromise,
      options.timeoutMs,
      "zatto utility process cleanup timed out",
    );
  }
  await rm(options.probeDirectory, { force: true, recursive: true });
}

/**
 * Preserves both a probe failure and a subsequent cleanup failure.
 *
 * @param probeError - Primary probe failure when one occurred
 * @param cleanupError - Failure raised while stopping the child or removing state
 * @returns Cleanup error or an AggregateError containing both failures
 */
export function combineZattoProbeErrors(
  probeError: Error | undefined,
  cleanupError: unknown,
): Error {
  const normalizedCleanupError =
    cleanupError instanceof Error
      ? cleanupError
      : new Error(String(cleanupError));
  if (!probeError) return normalizedCleanupError;
  return new AggregateError(
    [probeError, normalizedCleanupError],
    "zatto server probe failed and cleanup failed",
    { cause: probeError },
  );
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
