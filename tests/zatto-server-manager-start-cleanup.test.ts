import { describe, expect, it, vi } from "vitest";
import {
  createManagerFixture,
  Deferred,
  RUNTIME_RECORD,
} from "./zatto-server-manager-fixture";

describe("ZattoServerManager startup cleanup", () => {
  it("retains the same child for a later stop when cleanup fails", async () => {
    const fixture = createManagerFixture({
      requestHealth: vi.fn(async () =>
        Promise.reject(new Error("connection refused")),
      ),
      requestShutdown: vi.fn(async () =>
        Promise.reject(new Error("endpoint unavailable")),
      ),
    });
    vi.mocked(fixture.processHandle.kill)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        fixture.childExit.resolve(0);
        return true;
      });

    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "STARTUP_CLEANUP_FAILURE",
    });
    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "START_CONFLICT",
    });
    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_UNREACHABLE",
    });

    expect(fixture.dependencies.fork).toHaveBeenCalledOnce();
    expect(fixture.processHandle.kill).toHaveBeenCalledTimes(2);
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      expect.stringMatching(/server\.json$/),
    );
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      expect.stringMatching(/server\.json\.lock$/),
    );
  });

  it("does not wait for foreign runtime state after fallback termination", async () => {
    const fixture = createManagerFixture({
      pathExists: vi.fn(async () => true),
      readRuntimeRecord: vi.fn(async () => ({
        ...RUNTIME_RECORD,
        instanceId: "foreign-instance",
      })),
      requestShutdown: vi.fn(async () =>
        Promise.reject(new Error("endpoint unavailable")),
      ),
    });
    vi.mocked(fixture.processHandle.kill)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        fixture.childExit.resolve(0);
        return true;
      });

    await expect(fixture.manager.start()).rejects.toMatchObject({
      code: "STARTUP_CLEANUP_FAILURE",
    });
    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_UNREACHABLE",
    });

    expect(fixture.processHandle.kill).toHaveBeenCalledTimes(2);
    expect(fixture.dependencies.pathExists).not.toHaveBeenCalled();
  });

  it("retries cleanup of the same child after stop overlaps failed startup", async () => {
    const healthResponse = new Deferred<{ body: unknown; status: number }>();
    const fixture = createManagerFixture({
      requestHealth: vi.fn(() => healthResponse.promise),
      requestShutdown: vi.fn(async () =>
        Promise.reject(new Error("endpoint unavailable")),
      ),
    });
    vi.mocked(fixture.processHandle.kill)
      .mockReturnValueOnce(false)
      .mockImplementationOnce(() => {
        fixture.childExit.resolve(0);
        return true;
      });

    const starting = fixture.manager.start();
    const overlappingStop = fixture.manager.stop();
    healthResponse.reject(new Error("connection refused"));

    await expect(starting).rejects.toMatchObject({
      code: "STARTUP_CLEANUP_FAILURE",
    });
    await expect(overlappingStop).rejects.toMatchObject({
      code: "STARTUP_CLEANUP_FAILURE",
    });
    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_UNREACHABLE",
    });

    expect(fixture.dependencies.fork).toHaveBeenCalledOnce();
    expect(fixture.dependencies.requestHealth).toHaveBeenCalledOnce();
    expect(fixture.processHandle.kill).toHaveBeenCalledTimes(2);
  });
});
