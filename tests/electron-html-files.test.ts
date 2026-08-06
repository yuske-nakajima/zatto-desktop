import { describe, expect, it, vi } from "vitest";

import {
  createSingleFlightAction,
  serializeHtmlFileAdds,
} from "../src/main/electron-html-files";

describe("serializeHtmlFileAdds", () => {
  it("runs dialog and drop mutations in submission order", async () => {
    const releases: Array<() => void> = [];
    const operation = vi.fn(
      async (_paths: unknown) =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );
    const addFiles = serializeHtmlFileAdds(async (paths) => {
      await operation(paths);
      return { status: "unchanged" };
    });

    const first = addFiles(["/tmp/same.html"]);
    const second = addFiles(["/tmp/same.html"]);
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    releases.shift()?.();
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(2));
    releases.shift()?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "unchanged" },
      { status: "unchanged" },
    ]);
  });
});

describe("createSingleFlightAction", () => {
  it("ignores repeated shortcuts until the current dialog closes", async () => {
    let release: (() => void) | undefined;
    const operation = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const open = createSingleFlightAction(operation);

    open();
    open();
    expect(operation).toHaveBeenCalledOnce();
    release?.();
    await vi.waitFor(() => {
      open();
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
