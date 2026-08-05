import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureStream,
  waitForMissing,
  waitForRuntimeRecord,
  withTimeout,
} from "../src/main/zatto-server-probe-io";

const runtimeRecord = {
  instanceId: "desktop-probe-instance",
  pid: 1234,
  port: 49152,
  processFingerprint: "process-fingerprint",
  protocolVersion: 1,
};

let testDirectory: string;

beforeEach(async () => {
  testDirectory = await mkdtemp(path.join(tmpdir(), "zatto-probe-io-"));
});

afterEach(async () => {
  await rm(testDirectory, { force: true, recursive: true });
});

describe("waitForRuntimeRecord", () => {
  it("returns a valid runtime record", async () => {
    const runtimeFile = path.join(testDirectory, "server.json");
    await writeFile(runtimeFile, JSON.stringify(runtimeRecord));

    await expect(
      waitForRuntimeRecord(runtimeFile, 100, () => undefined),
    ).resolves.toEqual(runtimeRecord);
  });

  it("reports an early utility-process exit", async () => {
    const runtimeFile = path.join(testDirectory, "missing.json");

    await expect(
      waitForRuntimeRecord(runtimeFile, 100, () => 23),
    ).rejects.toThrow(
      "zatto utility process exited before startup with code 23",
    );
  });

  it("reports a startup timeout", async () => {
    const runtimeFile = path.join(testDirectory, "missing.json");

    await expect(
      waitForRuntimeRecord(runtimeFile, 0, () => undefined),
    ).rejects.toThrow("zatto runtime record was not created before timeout");
  });

  it("rejects invalid JSON without treating it as a missing file", async () => {
    const runtimeFile = path.join(testDirectory, "server.json");
    await writeFile(runtimeFile, "{");

    await expect(
      waitForRuntimeRecord(runtimeFile, 100, () => undefined),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});

describe("waitForMissing", () => {
  it("resolves after runtime state disappears", async () => {
    const runtimeFile = path.join(testDirectory, "server.json");
    await writeFile(runtimeFile, "{}");
    const removal = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        unlink(runtimeFile).then(() => resolve(), reject);
      }, 5);
    });

    await expect(waitForMissing(runtimeFile, 200)).resolves.toBeUndefined();
    await removal;
  });

  it("reports runtime state that remains after the deadline", async () => {
    const runtimeFile = path.join(testDirectory, "server.json");
    await writeFile(runtimeFile, "{}");

    await expect(waitForMissing(runtimeFile, 0)).rejects.toThrow(
      "zatto runtime state remained after shutdown",
    );
  });
});

describe("captureStream", () => {
  it("returns empty output for a missing stream", () => {
    expect(captureStream(null)()).toBe("");
  });

  it("retains only the bounded output tail", async () => {
    const stream = new PassThrough();
    const captured = captureStream(stream);
    stream.end(`prefix-${"x".repeat(4096)}-tail`);
    await new Promise<void>((resolve) => stream.once("end", resolve));

    expect(captured()).toHaveLength(4096);
    expect(captured()).toMatch(/-tail$/);
    expect(captured()).not.toContain("prefix-");
  });
});

describe("withTimeout", () => {
  it("returns the original promise value", async () => {
    await expect(
      withTimeout(Promise.resolve("ready"), 100, "timeout"),
    ).resolves.toBe("ready");
  });

  it("preserves rejection from the original promise", async () => {
    const failure = new Error("operation failed");

    await expect(
      withTimeout(Promise.reject(failure), 100, "timeout"),
    ).rejects.toBe(failure);
  });

  it("rejects after the deadline", async () => {
    await expect(
      withTimeout(
        new Promise<never>(() => undefined),
        1,
        "operation timed out",
      ),
    ).rejects.toThrow("operation timed out");
  });
});
