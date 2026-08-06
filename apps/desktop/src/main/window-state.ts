import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Rectangle in Electron screen coordinates. */
export interface WindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** Restorable desktop window state. */
export interface WindowState {
  bounds: WindowBounds;
  isFullScreen: boolean;
  isMaximized: boolean;
}

/** Replaceable persistence operations for window state. */
export interface WindowStateStorage {
  read: (filePath: string) => Promise<string>;
  rename: (source: string, destination: string) => Promise<void>;
  write: (filePath: string, contents: string) => Promise<void>;
}

/** Safe state used when persisted data cannot be trusted. */
export const DEFAULT_WINDOW_STATE: WindowState = {
  bounds: { height: 720, width: 960, x: 0, y: 0 },
  isFullScreen: false,
  isMaximized: false,
};

const DEFAULT_STORAGE: WindowStateStorage = {
  read: (filePath) => readFile(filePath, "utf8"),
  rename,
  write: (filePath, contents) => writeFile(filePath, contents, "utf8"),
};

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isWindowBounds(value: unknown): value is WindowBounds {
  if (typeof value !== "object" || value === null) return false;
  const bounds = value as Partial<Record<keyof WindowBounds, unknown>>;
  return (
    isSafeInteger(bounds.x) &&
    isSafeInteger(bounds.y) &&
    isSafeInteger(bounds.width) &&
    bounds.width > 0 &&
    isSafeInteger(bounds.height) &&
    bounds.height > 0
  );
}

/**
 * Parses persisted state without accepting partial or malformed values.
 *
 * @param stored - Serialized window state
 * @returns Valid state or the safe default
 */
export function parseWindowState(stored: string): WindowState {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_WINDOW_STATE;
    }
    const state = parsed as Partial<Record<keyof WindowState, unknown>>;
    if (
      !isWindowBounds(state.bounds) ||
      typeof state.isFullScreen !== "boolean" ||
      typeof state.isMaximized !== "boolean"
    ) {
      return DEFAULT_WINDOW_STATE;
    }
    return {
      bounds: state.bounds,
      isFullScreen: state.isFullScreen,
      isMaximized: state.isMaximized,
    };
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

function intersectionArea(first: WindowBounds, second: WindowBounds): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  );
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  );
  return width * height;
}

/**
 * Clamps window size and position into the best available work area.
 *
 * @param state - Parsed window state
 * @param workAreas - Available display work areas, primary display first
 * @returns State suitable for BrowserWindow restoration
 */
export function normalizeWindowState(
  state: WindowState,
  workAreas: readonly WindowBounds[],
): WindowState {
  if (workAreas.length === 0) return state;
  const area = workAreas.reduce((selected, candidate) =>
    intersectionArea(state.bounds, candidate) >
    intersectionArea(state.bounds, selected)
      ? candidate
      : selected,
  );
  const width = Math.min(Math.max(state.bounds.width, 640), area.width);
  const height = Math.min(Math.max(state.bounds.height, 480), area.height);
  return {
    ...state,
    bounds: {
      height,
      width,
      x: Math.min(
        Math.max(state.bounds.x, area.x),
        area.x + area.width - width,
      ),
      y: Math.min(
        Math.max(state.bounds.y, area.y),
        area.y + area.height - height,
      ),
    },
  };
}

/** Loads, captures, and flushes window state below Electron user data. */
export class WindowStateStore {
  private state: WindowState = DEFAULT_WINDOW_STATE;
  private readonly stateFile: string;
  private readonly temporaryFile: string;
  private readonly storage: WindowStateStorage;

  /**
   * Creates a store scoped to one Electron user-data directory.
   *
   * @param userDataPath - Electron user-data directory
   * @param storage - Replaceable persistence operations
   */
  constructor(
    userDataPath: string,
    storage: WindowStateStorage = DEFAULT_STORAGE,
  ) {
    this.stateFile = path.join(userDataPath, "window-state.json");
    this.temporaryFile = `${this.stateFile}.tmp`;
    this.storage = storage;
  }

  /**
   * Loads state and corrects bounds against available displays.
   *
   * @param workAreas - Available display work areas, primary display first
   * @returns Restorable window state
   */
  async load(workAreas: readonly WindowBounds[]): Promise<WindowState> {
    try {
      this.state = normalizeWindowState(
        parseWindowState(await this.storage.read(this.stateFile)),
        workAreas,
      );
    } catch {
      this.state = normalizeWindowState(DEFAULT_WINDOW_STATE, workAreas);
    }
    return this.state;
  }

  /**
   * Captures a validated in-memory snapshot for the next flush.
   *
   * @param state - Window bounds and display mode flags
   * @returns Nothing
   */
  capture(state: WindowState): void {
    this.state = state;
  }

  /**
   * Persists the latest captured state.
   *
   * @returns Completion of the persistence operation
   * @throws When the user-data state file cannot be written
   */
  async flush(): Promise<void> {
    await this.storage.write(this.temporaryFile, JSON.stringify(this.state));
    await this.storage.rename(this.temporaryFile, this.stateFile);
  }
}
