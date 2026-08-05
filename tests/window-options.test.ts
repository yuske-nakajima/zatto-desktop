import { describe, expect, it } from "vitest";

import { createMainWindowOptions } from "../src/main/window-options";

describe("createMainWindowOptions", () => {
  it("enables the required renderer security boundaries", () => {
    const options = createMainWindowOptions("/app/preload.js");

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      preload: "/app/preload.js",
      sandbox: true,
      webSecurity: true,
    });
  });

  it("provides a usable initial window size", () => {
    const options = createMainWindowOptions("/app/preload.js");

    expect(options).toMatchObject({
      height: 720,
      minHeight: 480,
      minWidth: 640,
      width: 960,
    });
  });
});
