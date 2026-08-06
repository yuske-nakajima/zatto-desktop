import type {
  ZattoHealthIdentity,
  ZattoRuntimeRecord,
} from "./zatto-server-contract";
import type { ZattoServerError } from "./zatto-server-errors";

/** Stable categories exposed for zatto server lifecycle failures. */
export type ZattoServerErrorCode =
  | "START_FAILURE"
  | "START_CONFLICT"
  | "STARTUP_TIMEOUT"
  | "RUNTIME_INVALID"
  | "INSTANCE_CONFLICT"
  | "HEALTH_INCOMPATIBLE"
  | "HEALTH_UNREACHABLE"
  | "EARLY_EXIT"
  | "UNEXPECTED_EXIT"
  | "STARTUP_CLEANUP_FAILURE"
  | "SHUTDOWN_REJECTED"
  | "SHUTDOWN_UNREACHABLE"
  | "SHUTDOWN_TIMEOUT"
  | "SHUTDOWN_EXIT_FAILURE"
  | "SHUTDOWN_CLEANUP_FAILURE"
  | "SHUTDOWN_KILL_FAILURE";

/** Launch request passed to the utility-process adapter. */
export interface ZattoServerLaunchRequest {
  args: string[];
  env: NodeJS.ProcessEnv;
  instanceId: string;
  serverEntry: string;
}

/** Retained handle for the utility process owned by the manager. */
export interface ZattoServerProcessHandle {
  exit: Promise<number>;
  kill: () => boolean;
  readStderr: () => string;
}

/** HTTP response data required by lifecycle validation. */
export interface ZattoServerResponse {
  body?: unknown;
  status: number;
}

/** Replaceable process, HTTP, filesystem, clock, and identity operations. */
export interface ZattoServerManagerDependencies {
  createInstanceId: () => string;
  fork: (request: ZattoServerLaunchRequest) => ZattoServerProcessHandle;
  now: () => number;
  pathExists: (targetPath: string) => Promise<boolean>;
  readRuntimeRecord: (runtimeFile: string) => Promise<unknown | undefined>;
  requestHealth: (url: string) => Promise<ZattoServerResponse>;
  requestShutdown: (
    url: string,
    instanceId: string,
  ) => Promise<ZattoServerResponse>;
  wait: (milliseconds: number) => Promise<void>;
}

/** Validated connection and state paths owned by the desktop application. */
export interface ZattoServerOwnership {
  health: ZattoHealthIdentity;
  instanceId: string;
  lockDirectory: string;
  port: number;
  runtimeFile: string;
  sessionFile: string;
  url: string;
}

/** Observable manager state without exposing the utility-process handle. */
export interface ZattoServerState {
  error?: ZattoServerError;
  ownership?: ZattoServerOwnership;
  status: "idle" | "starting" | "running" | "stopping" | "failed";
}

/** Configuration for one desktop-owned zatto server. */
export interface ZattoServerManagerOptions {
  dependencies: ZattoServerManagerDependencies;
  serverEntry: string;
  shutdownTimeoutMs: number;
  startupTimeoutMs: number;
  userDataPath: string;
}

/** Internal child state shared by startup, monitoring, and shutdown. */
export interface OwnedZattoServer {
  exitCode?: number;
  ownsRuntime: boolean;
  ownership: ZattoServerOwnership;
  process: ZattoServerProcessHandle;
}

/** Internal paths and launch identity for a startup operation. */
export interface ZattoServerStartContext {
  instanceId: string;
  lockDirectory: string;
  runtimeFile: string;
  sessionFile: string;
}

/** Parsed runtime identity used to validate health. */
export type OwnedRuntimeRecord = ZattoRuntimeRecord;
