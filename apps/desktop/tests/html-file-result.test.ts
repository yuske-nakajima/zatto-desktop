import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({ showMessageBox: vi.fn() }));

vi.mock("electron", () => ({
  dialog: { showMessageBox: electron.showMessageBox },
}));

import { reportHtmlFileAddResult } from "../src/main/html-file-result";

describe("reportHtmlFileAddResult", () => {
  beforeEach(() => electron.showMessageBox.mockReset());

  it.each([
    ["failed", "HTMLファイルを追加できませんでした。"],
    [
      "server-stopped",
      "zattoサーバーが停止しているため、HTMLファイルを追加できません。",
    ],
    [
      "unknown",
      "HTMLファイルの追加結果を確認できませんでした。セッション一覧を確認してください。",
    ],
  ] as const)("reports %s without a file path", async (status, message) => {
    const window = { isDestroyed: () => false } as BrowserWindow;
    await reportHtmlFileAddResult(
      status === "unknown" ? { serverStopped: false, status } : { status },
      window,
    );
    expect(electron.showMessageBox).toHaveBeenCalledWith(window, {
      message,
      title: "zatto",
      type: "error",
    });
    expect(message).not.toContain("/");
  });

  it.each(["cancelled", "unchanged"] as const)(
    "does not display an error for %s",
    async (status) => {
      await reportHtmlFileAddResult({ status }, {
        isDestroyed: () => false,
      } as BrowserWindow);
      expect(electron.showMessageBox).not.toHaveBeenCalled();
    },
  );

  it("reports a display failure as an already completed add", async () => {
    const window = { isDestroyed: () => false } as BrowserWindow;
    await reportHtmlFileAddResult(
      { addedCount: 1, display: "failed", status: "added" },
      window,
    );
    expect(electron.showMessageBox).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        message:
          "HTMLファイルは追加されましたが、先頭のファイルを表示できませんでした。",
      }),
    );
  });

  it("reports an unavailable server without an owner window", async () => {
    await reportHtmlFileAddResult({ status: "server-stopped" });
    expect(electron.showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
});
