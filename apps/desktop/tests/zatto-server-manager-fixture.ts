import path from "node:path";
import { vi } from "vitest";
import {
  ZattoServerManager,
  type ZattoServerManagerDependencies,
  type ZattoServerProcessHandle,
} from "../src/main/zatto-server-manager";

export const INSTANCE_ID = "desktop-owned-instance";
export const RUNTIME_RECORD = {
  instanceId: INSTANCE_ID,
  pid: 4321,
  port: 49152,
  processFingerprint: "desktop-owned-process",
  protocolVersion: 1,
};
export const HEALTH_IDENTITY = {
  instanceId: INSTANCE_ID,
  name: "zatto",
  protocolVersion: 1,
  version: "0.1.3",
};

/** Controllable promise used by lifecycle tests. */
export class Deferred<T> {
  readonly promise: Promise<T>;
  private resolvePromise: (value: T) => void = () => undefined;
  private rejectPromise: (reason: unknown) => void = () => undefined;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  }

  /** Resolves the pending promise. */
  resolve(value: T): void {
    this.resolvePromise(value);
  }

  /** Rejects the pending promise. */
  reject(reason: unknown): void {
    this.rejectPromise(reason);
  }
}

/** Test fixture for an owned zatto server manager. */
export interface ManagerFixture {
  childExit: Deferred<number>;
  dependencies: ZattoServerManagerDependencies;
  manager: ZattoServerManager;
  processHandle: ZattoServerProcessHandle;
}

/**
 * Creates a manager with deterministic lifecycle dependencies.
 *
 * @param overrides - Dependency behavior replaced by a test
 * @returns Manager, process handle, and dependency spies
 */
export function createManagerFixture(
  overrides: Partial<ZattoServerManagerDependencies> = {},
): ManagerFixture {
  const childExit = new Deferred<number>();
  let now = 0;
  const processHandle: ZattoServerProcessHandle = {
    exit: childExit.promise,
    kill: vi.fn(() => {
      childExit.resolve(0);
      return true;
    }),
    readStderr: () => "",
  };
  const dependencies: ZattoServerManagerDependencies = {
    createInstanceId: () => INSTANCE_ID,
    fork: vi.fn(() => processHandle),
    now: () => now,
    pathExists: vi.fn(async () => false),
    readRuntimeRecord: vi.fn(async () => RUNTIME_RECORD),
    requestHealth: vi.fn(async () => ({
      body: HEALTH_IDENTITY,
      status: 200,
    })),
    requestShutdown: vi.fn(async () => {
      childExit.resolve(0);
      return { status: 202 };
    }),
    wait: vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    }),
    ...overrides,
  };
  const manager = new ZattoServerManager({
    dependencies,
    serverEntry: "/bundle/server.js",
    shutdownTimeoutMs: 20,
    startupTimeoutMs: 20,
    userDataPath: path.join(path.parse(process.cwd()).root, "app data"),
  });
  return { childExit, dependencies, manager, processHandle };
}
