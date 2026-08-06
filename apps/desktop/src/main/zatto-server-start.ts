import { parseZattoRuntimeRecord } from "./zatto-server-contract";
import { ZattoServerError } from "./zatto-server-errors";
import type {
  OwnedRuntimeRecord,
  OwnedZattoServer,
  ZattoServerManagerOptions,
  ZattoServerProcessHandle,
  ZattoServerStartContext,
} from "./zatto-server-manager-types";
import {
  cleanupFailedZattoStartup,
  requestCompatibleZattoHealth,
} from "./zatto-server-start-operations";

const POLL_INTERVAL_MS = 50;

/**
 * Starts and validates one desktop-owned zatto utility process.
 *
 * @param options - Manager configuration and adapters
 * @param context - Dedicated paths and generated instance identity
 * @param retainChild - Stores the child as soon as process creation succeeds
 * @returns Retained child handle and validated ownership data
 * @throws ZattoServerError when startup or cleanup fails
 */
export async function startOwnedZattoServer(
  options: ZattoServerManagerOptions,
  context: ZattoServerStartContext,
  retainChild: (child: OwnedZattoServer) => void,
): Promise<OwnedZattoServer> {
  let processHandle: ZattoServerProcessHandle;
  try {
    processHandle = options.dependencies.fork({
      args: [
        "--port",
        "0",
        "--instance-id",
        context.instanceId,
        "--runtime-file",
        context.runtimeFile,
      ],
      env: { ...process.env, ZATTO_SESSION_FILE: context.sessionFile },
      instanceId: context.instanceId,
      serverEntry: options.serverEntry,
    });
  } catch (error) {
    throw new ZattoServerError(
      "START_FAILURE",
      "zatto utility process could not be started",
      error,
    );
  }

  const child: OwnedZattoServer = {
    ownsRuntime: false,
    ownership: {
      health: {
        instanceId: context.instanceId,
        name: "",
        protocolVersion: 0,
        version: "",
      },
      instanceId: context.instanceId,
      lockDirectory: context.lockDirectory,
      port: 0,
      runtimeFile: context.runtimeFile,
      sessionFile: context.sessionFile,
      url: "",
    },
    process: processHandle,
  };
  void processHandle.exit.then((code) => {
    child.exitCode = code;
  });
  retainChild(child);

  try {
    const runtimeRecord = await waitForOwnedRuntime(options, context, child);
    const url = `http://127.0.0.1:${runtimeRecord.port}`;
    const health = await requestCompatibleZattoHealth(
      options,
      runtimeRecord,
      url,
    );
    if (child.exitCode !== undefined) {
      throw earlyExitError(child.exitCode, processHandle.readStderr());
    }
    child.ownership = {
      health,
      instanceId: context.instanceId,
      lockDirectory: context.lockDirectory,
      port: runtimeRecord.port,
      runtimeFile: context.runtimeFile,
      sessionFile: context.sessionFile,
      url,
    };
    return child;
  } catch (error) {
    await cleanupFailedZattoStartup(child, options.shutdownTimeoutMs, error);
    throw error;
  }
}

async function waitForOwnedRuntime(
  options: ZattoServerManagerOptions,
  context: ZattoServerStartContext,
  child: OwnedZattoServer,
): Promise<OwnedRuntimeRecord> {
  const deadline = options.dependencies.now() + options.startupTimeoutMs;
  while (options.dependencies.now() < deadline) {
    if (child.exitCode !== undefined) {
      throw earlyExitError(child.exitCode, child.process.readStderr());
    }
    let value: unknown | undefined;
    try {
      value = await options.dependencies.readRuntimeRecord(context.runtimeFile);
    } catch (error) {
      throw new ZattoServerError(
        "RUNTIME_INVALID",
        "zatto runtime record could not be read",
        error,
      );
    }
    if (value !== undefined) {
      let runtimeRecord: OwnedRuntimeRecord;
      try {
        runtimeRecord = parseZattoRuntimeRecord(value);
      } catch (error) {
        throw new ZattoServerError(
          "RUNTIME_INVALID",
          "zatto runtime record is invalid",
          error,
        );
      }
      if (runtimeRecord.instanceId !== context.instanceId) {
        throw new ZattoServerError(
          "INSTANCE_CONFLICT",
          "zatto runtime record belongs to another instance",
        );
      }
      child.ownsRuntime = true;
      return runtimeRecord;
    }
    if (child.exitCode !== undefined) {
      throw earlyExitError(child.exitCode, child.process.readStderr());
    }
    await options.dependencies.wait(POLL_INTERVAL_MS);
  }
  throw new ZattoServerError(
    "STARTUP_TIMEOUT",
    "zatto runtime record was not created before timeout",
  );
}

function earlyExitError(code: number, stderr: string): ZattoServerError {
  const detail = stderr.trim();
  return new ZattoServerError(
    "EARLY_EXIT",
    `zatto utility process exited before startup with code ${code}${detail ? `: ${detail}` : ""}`,
  );
}
