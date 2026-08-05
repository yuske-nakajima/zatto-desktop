import { describe, expect, it, vi } from "vitest";
import { createZattoServerQuitHandler } from "../src/main/app-lifecycle";
import { ZattoServerError } from "../src/main/zatto-server-errors";
import { Deferred } from "./zatto-server-manager-fixture";

function createQuitEvent() {
  return { preventDefault: vi.fn() };
}

describe("createZattoServerQuitHandler", () => {
  it("stops once before allowing a reentrant quit", async () => {
    const stop = new Deferred<void>();
    const quit = vi.fn();
    const handler = createZattoServerQuitHandler({
      quit,
      reportError: vi.fn(),
      stop: vi.fn(() => stop.promise),
    });
    const firstEvent = createQuitEvent();
    const concurrentEvent = createQuitEvent();

    handler(firstEvent);
    handler(concurrentEvent);
    expect(firstEvent.preventDefault).toHaveBeenCalledOnce();
    expect(concurrentEvent.preventDefault).toHaveBeenCalledOnce();
    stop.resolve();
    await vi.waitFor(() => {
      expect(quit).toHaveBeenCalledOnce();
    });

    const reentrantEvent = createQuitEvent();
    handler(reentrantEvent);
    expect(reentrantEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("reports stop failure and still completes the guarded quit", async () => {
    const failure = new ZattoServerError(
      "SHUTDOWN_UNREACHABLE",
      "shutdown endpoint was unreachable after the owned child stopped",
    );
    const reportError = vi.fn();
    const quit = vi.fn();
    const handler = createZattoServerQuitHandler({
      quit,
      reportError,
      stop: vi.fn(async () => Promise.reject(failure)),
    });

    handler(createQuitEvent());
    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(failure);
      expect(quit).toHaveBeenCalledOnce();
    });
  });

  it("keeps the application alive and permits a retry when child cleanup fails", async () => {
    const failure = new ZattoServerError(
      "SHUTDOWN_KILL_FAILURE",
      "owned child remains alive",
    );
    const reportError = vi.fn();
    const quit = vi.fn();
    const stop = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const handler = createZattoServerQuitHandler({ quit, reportError, stop });

    handler(createQuitEvent());
    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(failure);
    });
    expect(quit).not.toHaveBeenCalled();

    handler(createQuitEvent());
    await vi.waitFor(() => {
      expect(stop).toHaveBeenCalledTimes(2);
      expect(quit).toHaveBeenCalledOnce();
    });
  });
});
