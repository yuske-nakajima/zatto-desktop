import type { BrowserWindow, OpenDialogOptions } from "electron";
import type { HtmlFileAddResult } from "./html-file-add";

/** Operations required to select and add local HTML files. */
export interface HtmlFileDialogDependencies<Window> {
  addFiles: (paths: readonly string[]) => Promise<HtmlFileAddResult>;
  showOpenDialog: (
    window: Window,
    options: OpenDialogOptions,
  ) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

/**
 * Shows the native multi-file dialog and forwards selected HTML paths.
 *
 * @param window - BrowserWindow that owns the native dialog
 * @param dependencies - Dialog and add-service operations
 * @returns Cancelled or add-service outcome
 * @throws When the native dialog or add operation rejects
 */
export async function chooseHtmlFiles<Window = BrowserWindow>(
  window: Window,
  dependencies: HtmlFileDialogDependencies<Window>,
): Promise<HtmlFileAddResult> {
  const selection = await dependencies.showOpenDialog(window, {
    filters: [{ extensions: ["html", "htm"], name: "HTML Files" }],
    properties: ["openFile", "multiSelections"],
    title: "HTMLファイルを開く",
  });
  if (selection.canceled) return { status: "cancelled" };
  return dependencies.addFiles(selection.filePaths);
}
