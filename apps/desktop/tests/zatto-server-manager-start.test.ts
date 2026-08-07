import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ZattoServerError } from "../src/main/zatto-server-manager";
import {
  createManagerFixture,
  Deferred,
  HEALTH_IDENTITY,
  INSTANCE_ID,
  RUNTIME_RECORD,
} from "./zatto-server-manager-fixture";

describe("ZattoServerManager start", () => {
  it("reports a utility-process fork failure", async () => {
    const fixture = createManagerFixture({
      fork: vi.fn(() => {
        throw new Error("fork unavailable");
      }),
    });

    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "START_FAILURE",
    });
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
  });

  it("starts one owned server with dedicated runtime and session paths", async () => {
    const fixture = createManagerFixture();
    const firstStart = fixture.manager.start();
    const secondStart = fixture.manager.start();

    expect(secondStart).toBe(firstStart);
    await expect(firstStart).resolves.toMatchObject({
      health: HEALTH_IDENTITY,
      instanceId: INSTANCE_ID,
      url: "http://127.0.0.1:49152",
    });
    const stateRoot = path.join(
      path.parse(process.cwd()).root,
      "app data",
      "zatto",
    );
    expect(fixture.dependencies.fork).toHaveBeenCalledExactlyOnceWith({
      args: [
        "--port",
        "0",
        "--instance-id",
        INSTANCE_ID,
        "--runtime-file",
        path.join(stateRoot, "server.json"),
      ],
      env: expect.objectContaining({
        ZATTO_SESSION_FILE: path.join(stateRoot, "session.json"),
      }),
      instanceId: INSTANCE_ID,
      serverEntry: "/bundle/server.js",
    });
  });

  it("rejects a new start while the retained child is stopping", async () => {
    const shutdownResponse = new Deferred<{ status: number }>();
    const fixture = createManagerFixture({
      requestShutdown: vi.fn(() => shutdownResponse.promise),
    });
    await fixture.manager.start();

    const stopping = fixture.manager.stop();
    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "START_CONFLICT",
    });
    expect(fixture.dependencies.fork).toHaveBeenCalledOnce();

    shutdownResponse.resolve({ status: 202 });
    fixture.childExit.resolve(0);
    await expect(stopping).resolves.toBeUndefined();
  });

  it.each([
    {
      code: "RUNTIME_INVALID",
      readRuntimeRecord: async () => ({ port: 0 }),
    },
    {
      code: "INSTANCE_CONFLICT",
      readRuntimeRecord: async () => ({
        ...RUNTIME_RECORD,
        instanceId: "foreign-instance",
      }),
    },
  ] as const)(
    "reports $code without touching foreign state",
    async (testCase) => {
      const fixture = createManagerFixture({
        readRuntimeRecord: vi.fn(testCase.readRuntimeRecord),
      });

      await expect(fixture.manager.start()).rejects.toMatchObject({
        code: testCase.code,
      });
      expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
      expect(fixture.dependencies.requestShutdown).not.toHaveBeenCalled();
    },
  );

  it("reports a startup timeout and stops only the retained child", async () => {
    const fixture = createManagerFixture({
      readRuntimeRecord: vi.fn(async () => undefined),
    });

    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "STARTUP_TIMEOUT",
    });
    expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
  });

  it("reports an early child exit without sending a signal", async () => {
    let fixture: ReturnType<typeof createManagerFixture>;
    fixture = createManagerFixture({
      readRuntimeRecord: vi.fn(async () => {
        fixture.childExit.resolve(23);
        await Promise.resolve();
        return undefined;
      }),
    });

    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "EARLY_EXIT",
    });
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
  });

  it.each([
    {
      code: "HEALTH_INCOMPATIBLE",
      requestHealth: async () => ({
        body: { ...HEALTH_IDENTITY, instanceId: "foreign-instance" },
        status: 200,
      }),
    },
    {
      code: "HEALTH_UNREACHABLE",
      requestHealth: async () =>
        Promise.reject(new Error("connection refused")),
    },
  ] as const)(
    "reports $code and stops the retained child",
    async (testCase) => {
      const fixture = createManagerFixture({
        requestHealth: vi.fn(testCase.requestHealth),
      });

      await expect(fixture.manager.start()).rejects.toMatchObject({
        code: testCase.code,
      });
      expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
    },
  );

  it("records an unexpected child exit after startup", async () => {
    const onUnexpectedError = vi.fn();
    const fixture = createManagerFixture();
    fixture.manager.setUnexpectedErrorHandler(onUnexpectedError);
    await fixture.manager.start();

    fixture.childExit.resolve(9);
    await Promise.resolve();
    await Promise.resolve();

    expect(fixture.manager.state).toMatchObject({
      error: expect.any(ZattoServerError),
      status: "failed",
    });
    expect(onUnexpectedError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UNEXPECTED_EXIT" }),
    );
  });
});
