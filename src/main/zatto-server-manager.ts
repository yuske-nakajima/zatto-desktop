import path from "node:path";
import { toZattoServerError, ZattoServerError } from "./zatto-server-errors";
import type {
  OwnedZattoServer,
  ZattoServerManagerOptions,
  ZattoServerOwnership,
  ZattoServerStartContext,
  ZattoServerState,
} from "./zatto-server-manager-types";
import { startOwnedZattoServer } from "./zatto-server-start";
import { stopOwnedZattoServer } from "./zatto-server-stop";

export { ZattoServerError } from "./zatto-server-errors";
export type {
  ZattoServerErrorCode,
  ZattoServerLaunchRequest,
  ZattoServerManagerDependencies,
  ZattoServerManagerOptions,
  ZattoServerOwnership,
  ZattoServerProcessHandle,
  ZattoServerResponse,
  ZattoServerState,
} from "./zatto-server-manager-types";

/** Owns one zatto utility process and coordinates its lifecycle. */
export class ZattoServerManager {
  private activeServer?: OwnedZattoServer;
  private readonly context: ZattoServerStartContext;
  private readonly options: ZattoServerManagerOptions;
  private startPromise?: Promise<ZattoServerOwnership>;
  private stopPromise?: Promise<void>;
  private unexpectedErrorHandler: (error: ZattoServerError) => void = () =>
    undefined;
  private visibleState: ZattoServerState = { status: "idle" };

  /**
   * Creates a manager for state isolated below the Electron user-data path.
   *
   * @param options - Paths, deadlines, and lifecycle adapters
   */
  constructor(options: ZattoServerManagerOptions) {
    this.options = options;
    const stateRoot = path.join(options.userDataPath, "zatto");
    const runtimeFile = path.join(stateRoot, "server.json");
    this.context = {
      instanceId: options.dependencies.createInstanceId(),
      lockDirectory: `${runtimeFile}.lock`,
      runtimeFile,
      sessionFile: path.join(stateRoot, "session.json"),
    };
  }

  /** Returns an immutable snapshot of the observable lifecycle state. */
  get state(): ZattoServerState {
    return { ...this.visibleState };
  }

  /**
   * Registers the callback for a child that exits while owned and running.
   *
   * @param handler - Receives a typed unexpected-exit error
   * @returns Nothing
   */
  setUnexpectedErrorHandler(handler: (error: ZattoServerError) => void): void {
    this.unexpectedErrorHandler = handler;
  }

  /**
   * Starts the owned server once and returns its validated connection data.
   *
   * @returns Shared startup operation or existing ownership data
   * @throws ZattoServerError when startup validation or ownership conflicts
   */
  start(): Promise<ZattoServerOwnership> {
    if (this.startPromise) return this.startPromise;
    if (this.activeServer && this.visibleState.status === "running") {
      return Promise.resolve(this.activeServer.ownership);
    }
    if (this.activeServer || this.stopPromise) {
      return Promise.reject(
        new ZattoServerError(
          "START_CONFLICT",
          "zatto server cannot start while an owned child is being stopped",
        ),
      );
    }
    const operation = this.startInternal();
    this.startPromise = operation;
    void operation
      .finally(() => {
        if (this.startPromise === operation) this.startPromise = undefined;
      })
      .catch(() => undefined);
    return operation;
  }

  /**
   * Stops the owned server once through authenticated graceful shutdown.
   *
   * @returns Shared shutdown operation
   * @throws ZattoServerError when shutdown or fallback termination fails
   */
  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    const operation = this.stopInternal(this.startPromise);
    this.stopPromise = operation;
    void operation
      .finally(() => {
        if (this.stopPromise === operation) this.stopPromise = undefined;
      })
      .catch(() => undefined);
    return operation;
  }

  private async startInternal(): Promise<ZattoServerOwnership> {
    this.visibleState = { status: "starting" };
    try {
      const activeServer = await startOwnedZattoServer(
        this.options,
        this.context,
        (child) => {
          this.activeServer = child;
        },
      );
      this.activeServer = activeServer;
      this.visibleState = {
        ownership: activeServer.ownership,
        status: "running",
      };
      this.monitorUnexpectedExit(activeServer);
      return activeServer.ownership;
    } catch (error) {
      const typedError = toZattoServerError(
        error,
        "START_FAILURE",
        "zatto server startup failed",
      );
      if (typedError.code !== "STARTUP_CLEANUP_FAILURE") {
        this.activeServer = undefined;
      }
      this.visibleState = { error: typedError, status: "failed" };
      throw typedError;
    }
  }

  private async stopInternal(
    startOperation?: Promise<ZattoServerOwnership>,
  ): Promise<void> {
    if (startOperation) await startOperation;
    const activeServer = this.activeServer;
    if (!activeServer) return;
    this.visibleState = {
      ownership: activeServer.ownership,
      status: "stopping",
    };
    try {
      await stopOwnedZattoServer(activeServer, this.options);
      this.activeServer = undefined;
      this.visibleState = { status: "idle" };
    } catch (error) {
      const typedError = toZattoServerError(
        error,
        "SHUTDOWN_UNREACHABLE",
        "zatto server shutdown failed",
      );
      this.visibleState = {
        error: typedError,
        ownership: activeServer.ownership,
        status: "failed",
      };
      if (activeServer.exitCode !== undefined) {
        this.activeServer = undefined;
      }
      throw typedError;
    }
  }

  private monitorUnexpectedExit(activeServer: OwnedZattoServer): void {
    void activeServer.process.exit.then((code) => {
      if (
        this.activeServer !== activeServer ||
        this.visibleState.status !== "running"
      ) {
        return;
      }
      const error = new ZattoServerError(
        "UNEXPECTED_EXIT",
        `zatto utility process exited unexpectedly with code ${code}`,
      );
      this.activeServer = undefined;
      this.visibleState = { error, status: "failed" };
      this.unexpectedErrorHandler(error);
    });
  }
}
