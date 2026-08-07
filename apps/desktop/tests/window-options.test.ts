import { describe, expect, it } from "vitest";

import { createMainWindowOptions } from "../src/main/window-options";

describe("createMainWindowOptions", () => {
  it("enables the required renderer security boundaries", () => {
    const options = createMainWindowOptions("/app/preload.js");

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      partition: "persist:zatto-desktop-window",
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

  it("uses restored bounds without weakening minimum sizes", () => {
    const options = createMainWindowOptions("/app/preload.js", {
      height: 800,
      width: 1200,
      x: 40,
      y: 60,
    });

    expect(options).toMatchObject({
      height: 800,
      minHeight: 480,
      minWidth: 640,
      width: 1200,
      x: 40,
      y: 60,
    });
  });

  it("fits minimum constraints to a smaller work area", () => {
    const options = createMainWindowOptions("/app/preload.js", {
      height: 300,
      width: 400,
      x: 0,
      y: 0,
    });

    expect(options).toMatchObject({
      height: 300,
      minHeight: 300,
      minWidth: 400,
      width: 400,
    });
  });
});
