import { describe, expect, it, vi } from "vitest";
import { bootstrapDesktopApplication } from "../src/main/application-bootstrap";

describe("bootstrapDesktopApplication", () => {
  it("leaves application lifecycle ownership to Squirrel events", () => {
    const dependencies = createDependencies({ isSquirrelStartup: true });

    bootstrapDesktopApplication(dependencies);

    expect(dependencies.registerBeforeQuit).not.toHaveBeenCalled();
    expect(dependencies.registerWindowAllClosed).not.toHaveBeenCalled();
    expect(dependencies.startWhenReady).not.toHaveBeenCalled();
  });

  it("registers the complete interactive application lifecycle", () => {
    const dependencies = createDependencies({});

    bootstrapDesktopApplication(dependencies);

    expect(dependencies.registerBeforeQuit).toHaveBeenCalledOnce();
    expect(dependencies.registerWindowAllClosed).toHaveBeenCalledOnce();
    expect(dependencies.startWhenReady).toHaveBeenCalledOnce();
  });

  it("starts a server probe without the interactive quit guard", () => {
    const dependencies = createDependencies({ isServerProbe: true });

    bootstrapDesktopApplication(dependencies);

    expect(dependencies.registerBeforeQuit).not.toHaveBeenCalled();
    expect(dependencies.registerWindowAllClosed).toHaveBeenCalledOnce();
    expect(dependencies.startWhenReady).toHaveBeenCalledOnce();
  });
});

function createDependencies(options: {
  isServerProbe?: boolean;
  isSquirrelStartup?: boolean;
}) {
  return {
    isServerProbe: options.isServerProbe ?? false,
    isSquirrelStartup: options.isSquirrelStartup ?? false,
    registerBeforeQuit: vi.fn(),
    registerWindowAllClosed: vi.fn(),
    startWhenReady: vi.fn(),
  };
}
