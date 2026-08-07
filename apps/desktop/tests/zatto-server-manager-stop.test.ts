import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createManagerFixture, Deferred } from "./zatto-server-manager-fixture";

describe("ZattoServerManager stop", () => {
  it("uses authenticated shutdown and never kills a normally exiting child", async () => {
    const fixture = createManagerFixture();
    await fixture.manager.start();

    await fixture.manager.stop();

    expect(
      fixture.dependencies.requestShutdown,
    ).toHaveBeenCalledExactlyOnceWith(
      "http://127.0.0.1:49152/api/shutdown",
      "desktop-owned-instance",
    );
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
    expect(fixture.manager.state).toEqual({ status: "idle" });
    const stateRoot = path.join(
      path.parse(process.cwd()).root,
      "app data",
      "zatto",
    );
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      path.join(stateRoot, "server.json"),
    );
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      path.join(stateRoot, "server.json.lock"),
    );
    expect(fixture.dependencies.pathExists).not.toHaveBeenCalledWith(
      path.join(stateRoot, "session.json"),
    );
  });

  it.each([
    {
      code: "SHUTDOWN_REJECTED",
      requestShutdown: async () => ({ status: 409 }),
    },
    {
      code: "SHUTDOWN_UNREACHABLE",
      requestShutdown: async () =>
        Promise.reject(new Error("connection refused")),
    },
  ] as const)(
    "reports $code and kills the retained live child",
    async (testCase) => {
      const fixture = createManagerFixture({
        requestShutdown: vi.fn(testCase.requestShutdown),
      });
      await fixture.manager.start();

      await expect(fixture.manager.stop()).rejects.toMatchObject({
        code: testCase.code,
      });
      expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
      expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
        expect.stringMatching(/server\.json$/),
      );
      expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
        expect.stringMatching(/server\.json\.lock$/),
      );
    },
  );

  it("falls back to the retained child when shutdown times out", async () => {
    const fixture = createManagerFixture({
      requestShutdown: vi.fn(() => new Promise<never>(() => undefined)),
    });
    await fixture.manager.start();

    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_TIMEOUT",
    });
    expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
  });

  it("reports fallback rejection from the retained child", async () => {
    const fixture = createManagerFixture({
      requestShutdown: vi.fn(async () => ({ status: 500 })),
    });
    vi.mocked(fixture.processHandle.kill).mockReturnValue(false);
    await fixture.manager.start();

    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_KILL_FAILURE",
    });
    expect(fixture.processHandle.kill).toHaveBeenCalledOnce();
  });

  it("reports an abnormal shutdown exit without killing a dead child", async () => {
    let fixture: ReturnType<typeof createManagerFixture>;
    fixture = createManagerFixture({
      requestShutdown: vi.fn(async () => {
        fixture.childExit.resolve(7);
        return { status: 202 };
      }),
    });
    await fixture.manager.start();

    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_EXIT_FAILURE",
    });
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      expect.stringMatching(/server\.json$/),
    );
    expect(fixture.dependencies.pathExists).toHaveBeenCalledWith(
      expect.stringMatching(/server\.json\.lock$/),
    );
  });

  it("preserves abnormal exit as the cause when runtime state remains", async () => {
    let fixture: ReturnType<typeof createManagerFixture>;
    fixture = createManagerFixture({
      pathExists: vi.fn(async () => true),
      requestShutdown: vi.fn(async () => {
        fixture.childExit.resolve(7);
        return { status: 202 };
      }),
    });
    await fixture.manager.start();

    await expect(fixture.manager.stop()).rejects.toMatchObject({
      cause: { code: "SHUTDOWN_EXIT_FAILURE" },
      code: "SHUTDOWN_CLEANUP_FAILURE",
    });
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
    expect(fixture.manager.state).toMatchObject({
      error: { code: "SHUTDOWN_CLEANUP_FAILURE" },
      status: "failed",
    });
    await expect(fixture.manager.stop()).resolves.toBeUndefined();
    expect(fixture.dependencies.requestShutdown).toHaveBeenCalledOnce();
  });

  it("reports retained runtime state without deleting it or the session", async () => {
    const fixture = createManagerFixture({
      pathExists: vi.fn(async () => true),
    });
    await fixture.manager.start();

    await expect(fixture.manager.stop()).rejects.toMatchObject({
      code: "SHUTDOWN_CLEANUP_FAILURE",
    });
    expect(fixture.processHandle.kill).not.toHaveBeenCalled();
  });

  it("shares a stop operation and treats later stops as no-ops", async () => {
    const shutdownResponse = new Deferred<{ status: number }>();
    const fixture = createManagerFixture({
      requestShutdown: vi.fn(() => shutdownResponse.promise),
    });
    await fixture.manager.start();

    const firstStop = fixture.manager.stop();
    const secondStop = fixture.manager.stop();
    expect(secondStop).toBe(firstStop);
    shutdownResponse.resolve({ status: 202 });
    fixture.childExit.resolve(0);
    await expect(firstStop).resolves.toBeUndefined();
    await expect(fixture.manager.stop()).resolves.toBeUndefined();
    expect(fixture.dependencies.requestShutdown).toHaveBeenCalledOnce();
  });
});
