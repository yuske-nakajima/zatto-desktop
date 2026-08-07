import { BrowserWindow } from "electron";
import { configureElectronWindowSecurity } from "./electron-window-security";
import {
  attachElectronWindowStateCapture,
  captureElectronWindowState,
} from "./electron-window-state";
import { loadWindowErrorScreen } from "./window-error-screen";
import { resolveWindowTarget, type WindowManagerState } from "./window-flow";
import { createMainWindowOptions } from "./window-options";
import { isAllowedOwnedNavigation } from "./window-security";
import {
  DEFAULT_WINDOW_STATE,
  normalizeWindowState,
  type WindowBounds,
  type WindowState,
  WindowStateStore,
} from "./window-state";
/** Configuration for the single managed application window. */
export interface ApplicationWindowOptions {
  getManagerState: () => WindowManagerState;
  getWorkAreas: () => readonly WindowBounds[];
  iconPath?: string;
  preloadUrl: string;
  rendererUrl: string;
  userDataPath: string;
}

/** Owns one BrowserWindow, its visible screen, and persisted display state. */
export class ApplicationWindow {
  private readonly getManagerState: () => WindowManagerState;
  private readonly getWorkAreas: () => readonly WindowBounds[];
  private readonly iconPath?: string;
  private readonly preloadUrl: string;
  private readonly rendererEntry: string;
  private recreation?: Promise<void>;
  private state: WindowState = DEFAULT_WINDOW_STATE;
  private readonly stateStore: WindowStateStore;
  private window?: BrowserWindow;

  /**
   * Creates a manager without loading renderer content.
   *
   * @param options - Renderer paths, state path, and manager-state accessor
   */
  constructor(options: ApplicationWindowOptions) {
    this.getManagerState = options.getManagerState;
    this.getWorkAreas = options.getWorkAreas;
    this.iconPath = options.iconPath;
    this.preloadUrl = options.preloadUrl;
    this.rendererEntry = options.rendererUrl;
    this.stateStore = new WindowStateStore(options.userDataPath);
  }

  /**
   * Loads and validates saved display state.
   *
   * @returns Restored state
   */
  async restore(): Promise<WindowState> {
    this.state = await this.stateStore.load(this.getWorkAreas());
    return this.state;
  }

  /**
   * Creates or returns the generation used by one startup sequence.
   *
   * @returns BrowserWindow generation retained across asynchronous startup
   */
  createGeneration(): BrowserWindow {
    return this.window ?? this.create();
  }

  /**
   * Loads the static preparation screen.
   *
   * @param window - BrowserWindow generation created for startup
   * @returns Completion of renderer loading
   */
  async loadPreparation(window: BrowserWindow): Promise<"closed" | "loaded"> {
    if (!this.isActive(window)) return "closed";
    try {
      await window.loadURL(this.staticRendererUrl("preparation"));
    } catch (error) {
      if (!this.isActive(window)) return "closed";
      throw error;
    }
    return this.isActive(window) ? "loaded" : "closed";
  }

  /**
   * Loads the validated owned zatto UI.
   *
   * @param window - BrowserWindow generation created for startup
   * @param url - Validated ownership URL returned by the manager
   * @returns Completion of zatto UI loading
   * @throws When the URL is not the manager's active ownership URL
   */
  async loadZatto(
    window: BrowserWindow,
    url: string,
  ): Promise<"closed" | "loaded"> {
    if (!this.isActive(window)) return "closed";
    const ownershipUrl = this.getManagerState().ownership?.url;
    if (
      ownershipUrl === undefined ||
      url !== ownershipUrl ||
      !isAllowedOwnedNavigation(url, ownershipUrl)
    ) {
      throw new Error("zatto ownership URL is unavailable");
    }
    try {
      await window.loadURL(url);
    } catch (error) {
      if (!this.isActive(window)) return "closed";
      throw error;
    }
    return this.isActive(window) ? "loaded" : "closed";
  }

  /**
   * Loads the dedicated error screen with a bundled fallback.
   *
   * @param window - Existing BrowserWindow generation, if one remains
   * @returns Completion of an error-screen load attempt
   */
  async loadError(
    window = this.window,
  ): Promise<"closed" | "loaded" | "quitting"> {
    if (window === undefined || !this.isActive(window)) return "closed";
    return loadWindowErrorScreen(window, this.staticRendererUrl("error"), () =>
      this.isActive(window),
    );
  }

  /**
   * Creates a closed application window again with manager-state content.
   *
   * @returns Completion of state-matched content loading
   */
  async recreateForManagerState(): Promise<void> {
    if (this.recreation !== undefined) return this.recreation;
    const recreation = this.performRecreation();
    this.recreation = recreation;
    try {
      await recreation;
    } finally {
      if (this.recreation === recreation) this.recreation = undefined;
    }
  }

  private async performRecreation(): Promise<void> {
    const window = this.window ?? this.create();
    const target = resolveWindowTarget(this.getManagerState());
    if (target.kind === "zatto") {
      await this.loadZatto(window, target.url);
    } else if (target.kind === "error") {
      await this.loadError(window);
    } else {
      await this.loadPreparation(window);
    }
  }

  /**
   * Captures and persists the latest state before application shutdown.
   *
   * @returns Completion of the user-data write
   * @throws When the state file cannot be written
   */
  async flush(): Promise<void> {
    if (this.window !== undefined) this.capture(this.window);
    await this.stateStore.flush();
  }

  /** @returns Current window without creating one, or undefined after close. */
  getWindow(): BrowserWindow | undefined {
    return this.window;
  }

  private create(): BrowserWindow {
    this.state = normalizeWindowState(this.state, this.getWorkAreas());
    const options = createMainWindowOptions(
      this.preloadUrl,
      this.state.bounds,
      this.iconPath,
    );
    const window = new BrowserWindow(options);
    configureElectronWindowSecurity(
      window.webContents,
      () => this.getManagerState().ownership?.url,
    );
    attachElectronWindowStateCapture(window, (state) => {
      this.state = state;
      this.stateStore.capture(state);
    });
    if (this.state.isMaximized) window.maximize();
    if (this.state.isFullScreen) window.setFullScreen(true);
    window.once("ready-to-show", () => window.show());
    window.once("closed", () => {
      if (this.window === window) this.window = undefined;
    });
    this.window = window;
    return window;
  }

  private capture(window: BrowserWindow): void {
    this.state = captureElectronWindowState(window);
    this.stateStore.capture(this.state);
  }

  private staticRendererUrl(state: "error" | "preparation"): string {
    const url = new URL(this.rendererEntry);
    url.searchParams.set("state", state);
    return url.toString();
  }

  private isActive(window: BrowserWindow): boolean {
    return this.window === window && !window.isDestroyed();
  }
}
