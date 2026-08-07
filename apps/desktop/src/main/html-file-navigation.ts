import type { BrowserWindow } from "electron";
import { isAllowedOwnedNavigation } from "./owned-origin";
import type { WindowManagerState } from "./window-flow";

/**
 * Loads the owned UI with an added entry selected.
 *
 * @param window - Active application window
 * @param state - Current server manager state
 * @param entryId - Validated entry identifier returned by zatto
 * @param ownershipUrl - Ownership URL used for the corresponding add request
 * @returns Completion of owned UI navigation
 * @throws When the window or ownership changed before navigation
 */
export async function showAddedHtmlEntry(
  window: Pick<BrowserWindow, "isDestroyed" | "loadURL"> | undefined,
  state: WindowManagerState,
  entryId: string,
  ownershipUrl: string,
): Promise<void> {
  if (
    window === undefined ||
    window.isDestroyed() ||
    state.status !== "running" ||
    state.ownership?.url !== ownershipUrl ||
    entryId.length === 0
  ) {
    throw new Error("owned zatto window is unavailable");
  }
  const destination = new URL(ownershipUrl);
  destination.searchParams.set("entry", entryId);
  if (!isAllowedOwnedNavigation(destination.toString(), ownershipUrl)) {
    throw new Error("owned zatto entry URL is invalid");
  }
  await window.loadURL(destination.toString());
}
