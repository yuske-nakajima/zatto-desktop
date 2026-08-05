import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupZattoProbeState,
  combineZattoProbeErrors,
} from "../src/main/zatto-server-probe-io";

let testDirectory: string;

beforeEach(async () => {
  testDirectory = await mkdtemp(path.join(tmpdir(), "zatto-probe-cleanup-"));
});

afterEach(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

describe("cleanupZattoProbeState", () => {
  it("removes probe state after the child has exited", async () => {
    const probeDirectory = path.join(testDirectory, "probe");
    await mkdir(probeDirectory, { recursive: true });

    await cleanupZattoProbeState({
      exitPromise: Promise.resolve(0),
      hasExited: () => true,
      kill: () => true,
      probeDirectory,
      timeoutMs: 100,
    });

    await expect(access(probeDirectory)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps probe state and reports a child exit timeout", async () => {
    const probeDirectory = path.join(testDirectory, "probe");
    await mkdir(probeDirectory, { recursive: true });
    let killCalled = false;

    await expect(
      cleanupZattoProbeState({
        exitPromise: new Promise<never>(() => undefined),
        hasExited: () => false,
        kill: () => {
          killCalled = true;
          return true;
        },
        probeDirectory,
        timeoutMs: 1,
      }),
    ).rejects.toThrow("zatto utility process cleanup timed out");
    expect(killCalled).toBe(true);
    await expect(access(probeDirectory)).resolves.toBeUndefined();
  });

  it("keeps probe state when the child rejects cleanup SIGTERM", async () => {
    const probeDirectory = path.join(testDirectory, "probe");
    await mkdir(probeDirectory, { recursive: true });

    await expect(
      cleanupZattoProbeState({
        exitPromise: new Promise<never>(() => undefined),
        hasExited: () => false,
        kill: () => false,
        probeDirectory,
        timeoutMs: 100,
      }),
    ).rejects.toThrow("zatto utility process did not accept cleanup SIGTERM");
    await expect(access(probeDirectory)).resolves.toBeUndefined();
  });

  it("preserves the probe and cleanup failures", () => {
    const probeError = new Error("health validation failed");
    const cleanupError = new Error("child remained alive");
    const combined = combineZattoProbeErrors(probeError, cleanupError);

    expect(combined).toBeInstanceOf(AggregateError);
    expect(combined.message).toBe(
      "zatto server probe failed and cleanup failed",
    );
    expect((combined as AggregateError).errors).toEqual([
      probeError,
      cleanupError,
    ]);
  });
});
