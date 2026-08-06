import { describe, expect, it, vi } from "vitest";
import { runZattoServerProbeLifecycle } from "../src/main/zatto-server-probe-runner";
import { HEALTH_IDENTITY, INSTANCE_ID } from "./zatto-server-manager-fixture";

const ownership = {
  health: HEALTH_IDENTITY,
  instanceId: INSTANCE_ID,
  lockDirectory: "/probe/zatto/server.json.lock",
  port: 49152,
  runtimeFile: "/probe/zatto/server.json",
  sessionFile: "/probe/zatto/session.json",
  url: "http://127.0.0.1:49152",
};

describe("runZattoServerProbeLifecycle", () => {
  it("uses isolated state and removes it only after confirmed stop", async () => {
    const operations: string[] = [];
    const removeProbeUserDataRoot = vi.fn(async () => {
      operations.push("remove");
    });
    const createManager = vi.fn(() => ({
      start: async () => {
        operations.push("start");
        return ownership;
      },
      stop: async () => {
        operations.push("stop");
      },
    }));

    await expect(
      runZattoServerProbeLifecycle({
        createManager,
        createProbeUserDataRoot: async () => "/user-data/probes/probe-a",
        removeProbeUserDataRoot,
      }),
    ).resolves.toEqual({
      health: HEALTH_IDENTITY,
      lockReleased: true,
      port: 49152,
      runtimeRecordReleased: true,
    });
    expect(createManager).toHaveBeenCalledWith("/user-data/probes/probe-a");
    expect(operations).toEqual(["start", "stop", "remove"]);
  });

  it("retains isolated state when stop does not confirm child exit", async () => {
    const removeProbeUserDataRoot = vi.fn();

    await expect(
      runZattoServerProbeLifecycle({
        createManager: () => ({
          start: async () => ownership,
          stop: async () => Promise.reject(new Error("child remained alive")),
        }),
        createProbeUserDataRoot: async () => "/user-data/probes/probe-b",
        removeProbeUserDataRoot,
      }),
    ).rejects.toThrow("child remained alive");
    expect(removeProbeUserDataRoot).not.toHaveBeenCalled();
  });
});
