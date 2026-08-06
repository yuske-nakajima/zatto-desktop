import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { session, utilityProcess } from "electron";
import { resolveZattoServerEntry } from "./zatto-server-entry";
import type {
  ZattoServerLaunchRequest,
  ZattoServerManagerDependencies,
  ZattoServerProcessHandle,
  ZattoServerResponse,
} from "./zatto-server-manager";
import { ZattoServerManager } from "./zatto-server-manager";

const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

/**
 * Creates a zatto server manager backed by Electron and host I/O adapters.
 *
 * @param appPath - Electron application root containing zatto
 * @param userDataPath - Application-owned persistent state root
 * @returns Manager for one desktop-owned utility process
 */
export function createElectronZattoServerManager(
  appPath: string,
  userDataPath: string,
): ZattoServerManager {
  return new ZattoServerManager({
    dependencies: createElectronDependencies(),
    serverEntry: resolveZattoServerEntry(appPath),
    shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
    startupTimeoutMs: STARTUP_TIMEOUT_MS,
    userDataPath,
  });
}

function createElectronDependencies(): ZattoServerManagerDependencies {
  return {
    createInstanceId: randomUUID,
    fork: forkZattoProcess,
    now: Date.now,
    pathExists,
    readRuntimeRecord,
    requestHealth,
    requestShutdown,
    wait: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  };
}

function forkZattoProcess(
  request: ZattoServerLaunchRequest,
): ZattoServerProcessHandle {
  const child = utilityProcess.fork(request.serverEntry, request.args, {
    env: request.env,
    serviceName: "zatto server",
    session: session.fromPartition("zatto-server"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-4096);
  });
  const exit = new Promise<number>((resolve) => {
    child.once("exit", resolve);
  });
  return {
    exit,
    kill: () => child.kill(),
    readStderr: () => stderr,
  };
}

async function readRuntimeRecord(
  runtimeFile: string,
): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(runtimeFile, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
}

async function requestHealth(url: string): Promise<ZattoServerResponse> {
  const response = await fetch(url);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return { body, status: response.status };
}

async function requestShutdown(
  url: string,
  instanceId: string,
): Promise<ZattoServerResponse> {
  const response = await fetch(url, {
    headers: { "x-zatto-instance-id": instanceId },
    method: "POST",
  });
  return { status: response.status };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) return false;
    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
