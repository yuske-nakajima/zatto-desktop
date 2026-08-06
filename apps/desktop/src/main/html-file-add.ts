import {
  type PreparedHtmlFilePaths,
  prepareHtmlFilePaths,
} from "./html-file-paths";
import {
  type HtmlFileAddResponse,
  type HtmlFileSessionEntry,
  inspectHtmlFileSession,
  parseAddedIds,
} from "./html-file-request";
import { isAllowedOwnedNavigation } from "./owned-origin";
import type { WindowManagerState } from "./window-flow";

const REQUEST_TIMEOUT_MS = 5_000;

/** Result of one desktop HTML-file add request. */
export type HtmlFileAddResult =
  | {
      addedCount: number;
      display: "failed" | "server-stopped" | "shown";
      status: "added";
    }
  | {
      serverStopped: boolean;
      status: "unknown";
    }
  | { status: "cancelled" | "failed" | "server-stopped" | "unchanged" };

/** Replaceable state, filesystem, HTTP, and navigation operations. */
export interface HtmlFileAddDependencies {
  getState: () => WindowManagerState;
  inspectSession?: (
    ownershipUrl: string,
    signal: AbortSignal,
  ) => Promise<HtmlFileSessionEntry[]>;
  preparePaths?: (value: unknown) => Promise<PreparedHtmlFilePaths>;
  request: (
    url: string,
    paths: readonly string[],
    signal: AbortSignal,
  ) => Promise<HtmlFileAddResponse>;
  showEntry: (entryId: string, ownershipUrl: string) => Promise<void>;
}

/**
 * Adds HTML paths through the active owned server and displays the first add.
 *
 * @param value - Paths selected by the OS or resolved from dropped files
 * @param dependencies - Current state, filesystem, HTTP, and navigation
 * @returns Classified add outcome without file-system path data
 */
export async function addHtmlFiles(
  value: unknown,
  dependencies: HtmlFileAddDependencies,
): Promise<HtmlFileAddResult> {
  const prepared = await (dependencies.preparePaths ?? prepareHtmlFilePaths)(
    value,
  );
  if (prepared.status !== "ready") return { status: prepared.status };
  const ownershipUrl = getRunningOwnershipUrl(dependencies.getState());
  if (ownershipUrl === undefined) return { status: "server-stopped" };
  if (!isAllowedOwnedNavigation(ownershipUrl, ownershipUrl)) {
    return { status: "failed" };
  }
  const endpoint = new URL("api/session/add", ownershipUrl).toString();
  if (!isAllowedOwnedNavigation(endpoint, ownershipUrl)) {
    return { status: "failed" };
  }

  const inspectSession = dependencies.inspectSession ?? inspectHtmlFileSession;
  const entriesBefore = await inspectSessionSafely(
    inspectSession,
    ownershipUrl,
  );
  let response: HtmlFileAddResponse;
  try {
    response = await dependencies.request(
      endpoint,
      prepared.paths,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    );
  } catch {
    return reconcileUncertainAdd(
      prepared.paths,
      entriesBefore,
      ownershipUrl,
      dependencies,
      inspectSession,
    );
  }
  if (response.status !== 201) return { status: "failed" };
  const addedIds = parseAddedIds(response.body);
  if (addedIds === undefined) {
    return reconcileUncertainAdd(
      prepared.paths,
      entriesBefore,
      ownershipUrl,
      dependencies,
      inspectSession,
    );
  }
  const firstId = addedIds[0];
  if (firstId === undefined) return { status: "unchanged" };

  return displayAddedEntries(addedIds, ownershipUrl, dependencies);
}

async function reconcileUncertainAdd(
  paths: readonly string[],
  entriesBefore: readonly HtmlFileSessionEntry[] | undefined,
  ownershipUrl: string,
  dependencies: HtmlFileAddDependencies,
  inspectSession: NonNullable<HtmlFileAddDependencies["inspectSession"]>,
): Promise<HtmlFileAddResult> {
  const entriesAfter = await inspectSessionSafely(inspectSession, ownershipUrl);
  if (entriesAfter === undefined || entriesBefore === undefined) {
    return unknownAddResult(dependencies, ownershipUrl);
  }
  const previousIds = new Set(entriesBefore.map((entry) => entry.id));
  const selectedPaths = new Set(paths);
  const addedIds = entriesAfter
    .filter(
      (entry) => selectedPaths.has(entry.absPath) && !previousIds.has(entry.id),
    )
    .map((entry) => entry.id);
  if (addedIds.length === 0) {
    return unknownAddResult(dependencies, ownershipUrl);
  }
  return displayAddedEntries(addedIds, ownershipUrl, dependencies);
}

function unknownAddResult(
  dependencies: HtmlFileAddDependencies,
  ownershipUrl: string,
): HtmlFileAddResult {
  return {
    serverStopped:
      getRunningOwnershipUrl(dependencies.getState()) !== ownershipUrl,
    status: "unknown",
  };
}

async function displayAddedEntries(
  addedIds: readonly string[],
  ownershipUrl: string,
  dependencies: HtmlFileAddDependencies,
): Promise<HtmlFileAddResult> {
  const firstId = addedIds[0];
  if (firstId === undefined) return { status: "unchanged" };
  if (getRunningOwnershipUrl(dependencies.getState()) !== ownershipUrl) {
    return {
      addedCount: addedIds.length,
      display: "server-stopped",
      status: "added",
    };
  }
  try {
    await dependencies.showEntry(firstId, ownershipUrl);
    return {
      addedCount: addedIds.length,
      display: "shown",
      status: "added",
    };
  } catch {
    return {
      addedCount: addedIds.length,
      display:
        getRunningOwnershipUrl(dependencies.getState()) === ownershipUrl
          ? "failed"
          : "server-stopped",
      status: "added",
    };
  }
}

async function inspectSessionSafely(
  inspectSession: NonNullable<HtmlFileAddDependencies["inspectSession"]>,
  ownershipUrl: string,
): Promise<HtmlFileSessionEntry[] | undefined> {
  try {
    return await inspectSession(ownershipUrl, AbortSignal.timeout(2_000));
  } catch {
    return undefined;
  }
}

function getRunningOwnershipUrl(state: WindowManagerState): string | undefined {
  return state.status === "running" ? state.ownership?.url : undefined;
}
