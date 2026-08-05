import { type BrowserWindow, dialog } from "electron";
import type { HtmlFileAddResult } from "./html-file-add";

/**
 * Shows a path-free native message for an actionable add failure.
 *
 * @param result - Classified outcome returned by the add service
 * @param window - Current application window, when one exists
 * @returns Completion of native result reporting
 * @throws When Electron cannot display the native message
 */
export async function reportHtmlFileAddResult(
  result: HtmlFileAddResult,
  window?: BrowserWindow,
): Promise<void> {
  const message = resultMessage(result);
  if (message === undefined) return;
  const options = {
    message,
    title: "Zatto Desktop",
    type: "error" as const,
  };
  if (window === undefined || window.isDestroyed()) {
    await dialog.showMessageBox(options);
  } else {
    await dialog.showMessageBox(window, options);
  }
}

function resultMessage(result: HtmlFileAddResult): string | undefined {
  if (result.status === "failed") {
    return "HTMLファイルを追加できませんでした。";
  }
  if (result.status === "server-stopped") {
    return "zattoサーバーが停止しているため、HTMLファイルを追加できません。";
  }
  if (result.status === "unknown") {
    return result.serverStopped
      ? "zattoサーバーが停止したため、HTMLファイルの追加結果を確認できませんでした。"
      : "HTMLファイルの追加結果を確認できませんでした。セッション一覧を確認してください。";
  }
  if (result.status === "added" && result.display === "server-stopped") {
    return "HTMLファイルは追加されましたが、zattoサーバーが停止したため表示できませんでした。";
  }
  if (result.status === "added" && result.display === "failed") {
    return "HTMLファイルは追加されましたが、先頭のファイルを表示できませんでした。";
  }
  return undefined;
}
