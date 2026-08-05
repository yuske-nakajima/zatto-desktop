import { describe, expect, it, vi } from "vitest";

import { resolveWindowTarget, runWindowStartup } from "../src/main/window-flow";

describe("runWindowStartup", () => {
  it("loads preparation before starting the server and loading zatto", async () => {
    const calls: string[] = [];
    await runWindowStartup({
      createGeneration: () => "window",
      loadError: vi.fn(async () => calls.push("error")),
      loadPreparation: vi.fn(async () => {
        calls.push("preparation");
        return "loaded" as const;
      }),
      loadZatto: vi.fn(async () => {
        calls.push("zatto");
        return "loaded" as const;
      }),
      startServer: vi.fn(async () => {
        calls.push("start");
        return { url: "http://127.0.0.1:43120/" };
      }),
    });

    expect(calls).toEqual(["preparation", "start", "zatto"]);
  });

  it.each(["preparation", "start", "zatto"])(
    "loads the error screen when %s fails",
    async (failurePoint) => {
      const calls: string[] = [];
      await runWindowStartup({
        createGeneration: () => "window",
        loadError: vi.fn(async () => calls.push("error")),
        loadPreparation: vi.fn(async () => {
          calls.push("preparation");
          if (failurePoint === "preparation") throw new Error("load failed");
          return "loaded" as const;
        }),
        loadZatto: vi.fn(async () => {
          calls.push("zatto");
          if (failurePoint === "zatto") throw new Error("load failed");
          return "loaded" as const;
        }),
        startServer: vi.fn(async () => {
          if (failurePoint === "start") throw new Error("start failed");
          return { url: "http://127.0.0.1:43120/" };
        }),
      });

      expect(calls.at(-1)).toBe("error");
      expect(calls[0]).toBe("preparation");
    },
  );

  it("does not recreate a closed preparation-window generation", async () => {
    const generation = { closed: false };
    const createWindow = vi.fn(() => generation);
    const loadError = vi.fn();
    const loadZatto = vi.fn(async (target: typeof generation) =>
      target.closed ? ("closed" as const) : ("loaded" as const),
    );

    await runWindowStartup({
      createGeneration: createWindow,
      loadError,
      loadPreparation: async () => "loaded" as const,
      loadZatto,
      startServer: async () => {
        generation.closed = true;
        return { url: "http://127.0.0.1:43120/" };
      },
    });

    expect(createWindow).toHaveBeenCalledOnce();
    expect(loadZatto).toHaveBeenCalledWith(
      generation,
      "http://127.0.0.1:43120/",
    );
    expect(loadError).not.toHaveBeenCalled();
  });

  it("starts the server when the preparation closes during loading", async () => {
    const generation = { closed: false };
    const startServer = vi.fn(async () => ({
      url: "http://127.0.0.1:43120/",
    }));
    const loadZatto = vi.fn();

    await expect(
      runWindowStartup({
        createGeneration: () => generation,
        loadError: vi.fn(),
        loadPreparation: async () => {
          generation.closed = true;
          return "closed" as const;
        },
        loadZatto,
        startServer,
      }),
    ).resolves.toBe("closed");

    expect(startServer).toHaveBeenCalledOnce();
    expect(loadZatto).not.toHaveBeenCalled();
  });
});

describe("resolveWindowTarget", () => {
  it("selects the screen that matches manager state", () => {
    expect(resolveWindowTarget({ status: "starting" })).toEqual({
      kind: "preparation",
    });
    expect(
      resolveWindowTarget({
        ownership: { url: "http://127.0.0.1:43120/" },
        status: "running",
      }),
    ).toEqual({ kind: "zatto", url: "http://127.0.0.1:43120/" });
    expect(resolveWindowTarget({ status: "failed" })).toEqual({
      kind: "error",
    });
  });
});
