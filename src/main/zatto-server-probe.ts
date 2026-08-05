import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { session, utilityProcess } from "electron";
import type {
  ZattoHealthIdentity,
  ZattoRuntimeRecord,
} from "./zatto-server-contract";
import { validateZattoHealthIdentity } from "./zatto-server-contract";
import { resolveZattoServerEntry } from "./zatto-server-entry";
import {
  captureStream,
  cleanupZattoProbeState,
  combineZattoProbeErrors,
  waitForMissing,
  waitForRuntimeRecord,
  withTimeout,
} from "./zatto-server-probe-io";

const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 5_000;

/** Result emitted by the zatto utility-process smoke test. */
export interface ZattoServerProbeResult {
  health: ZattoHealthIdentity;
  lockReleased: boolean;
  port: number;
  runtimeRecordReleased: boolean;
}

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
  const serverEntry = resolveZattoServerEntry(appPath);
  try {
    await access(serverEntry);
  } catch (error) {
    throw new Error("bundled zatto server entry is missing", { cause: error });
  }
  const probeRoot = path.join(userDataPath, "zatto-server-probes");
  await mkdir(probeRoot, { mode: 0o700, recursive: true });
  const probeDirectory = await mkdtemp(path.join(probeRoot, "probe-"));
  const runtimeFile = path.join(probeDirectory, "server.json");
  const sessionFile = path.join(probeDirectory, "session.json");
  const lockDirectory = `${runtimeFile}.lock`;
  const instanceId = randomUUID();
  const child = utilityProcess.fork(
    serverEntry,
    ["--port", "0", "--instance-id", instanceId, "--runtime-file", runtimeFile],
    {
      env: { ...process.env, ZATTO_SESSION_FILE: sessionFile },
      serviceName: "Zatto Server Probe",
      session: session.fromPartition(`zatto-server-probe-${instanceId}`),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const stderr = captureStream(child.stderr);
  let exited = false;
  let exitCode: number | undefined;
  const exitPromise = new Promise<number>((resolve) => {
    child.once("exit", (code) => {
      exited = true;
      exitCode = code;
      resolve(code);
    });
  });
  let probeError: Error | undefined;
  let result: ZattoServerProbeResult | undefined;

  try {
    const runtimeRecord = await waitForRuntimeRecord(
      runtimeFile,
      START_TIMEOUT_MS,
      () => exitCode,
    );
    if (runtimeRecord.instanceId !== instanceId) {
      throw new Error("zatto runtime record belongs to another instance");
    }
    const health = await fetchHealth(runtimeRecord);
    if (!child.kill()) {
      throw new Error("zatto utility process did not accept SIGTERM");
    }
    const stoppedCode = await withTimeout(
      exitPromise,
      STOP_TIMEOUT_MS,
      "zatto utility process did not exit after SIGTERM",
    );
    if (stoppedCode !== 0) {
      throw new Error(`zatto utility process exited with code ${stoppedCode}`);
    }
    await waitForMissing(runtimeFile, STOP_TIMEOUT_MS);
    await waitForMissing(lockDirectory, STOP_TIMEOUT_MS);
    result = {
      health,
      lockReleased: true,
      port: runtimeRecord.port,
      runtimeRecordReleased: true,
    };
  } catch (error) {
    const detail = stderr().trim();
    probeError = new Error(
      `zatto server probe failed: ${detail.length > 0 ? detail : errorMessage(error)}`,
      { cause: error },
    );
  }

  let cleanupError: unknown;
  try {
    await cleanupZattoProbeState({
      exitPromise,
      hasExited: () => exited,
      kill: () => child.kill(),
      probeDirectory,
      timeoutMs: STOP_TIMEOUT_MS,
    });
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError !== undefined) {
    throw combineZattoProbeErrors(probeError, cleanupError);
  }
  if (probeError) throw probeError;
  if (!result) throw new Error("zatto server probe did not produce a result");
  return result;
}

async function fetchHealth(
  runtimeRecord: ZattoRuntimeRecord,
): Promise<ZattoHealthIdentity> {
  const response = await fetch(
    `http://127.0.0.1:${runtimeRecord.port}/api/health`,
    { signal: AbortSignal.timeout(STOP_TIMEOUT_MS) },
  );
  if (!response.ok) {
    throw new Error(`zatto health request returned HTTP ${response.status}`);
  }
  const value: unknown = await response.json();
  return validateZattoHealthIdentity(value, runtimeRecord);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
