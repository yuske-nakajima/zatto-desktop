import { describe, expect, it, vi } from "vitest";

import {
  HTML_FILE_DROP_CHANNEL,
  registerHtmlFileDrop,
} from "../src/main/html-file-drop";

describe("registerHtmlFileDrop", () => {
  it("accepts a validated main-frame sender on the owned origin", async () => {
    let listener: DropListener | undefined;
    const ipcMain = {
      on: vi.fn((_: string, next: DropListener) => {
        listener = next;
      }),
    };
    const mainFrame = { url: "http://127.0.0.1:49152/?entry=old" };
    const webContents = { mainFrame };
    const window = { webContents };
    const addFiles = vi.fn(async () => ({
      addedCount: 1,
      display: "shown" as const,
      status: "added" as const,
    }));
    const reportResult = vi.fn();
    registerHtmlFileDrop({
      addFiles,
      getOwnershipUrl: () => "http://127.0.0.1:49152/",
      getWindow: () => window,
      ipcMain,
      reportResult,
    });

    listener?.({ sender: webContents, senderFrame: mainFrame }, [
      "/tmp/a.html",
      "/tmp/b.htm",
    ]);
    await vi.waitFor(() => expect(addFiles).toHaveBeenCalledOnce());
    expect(ipcMain.on).toHaveBeenCalledWith(
      HTML_FILE_DROP_CHANNEL,
      expect.any(Function),
    );
    expect(reportResult).toHaveBeenCalledWith({
      addedCount: 1,
      display: "shown",
      status: "added",
    });
  });

  it("rejects foreign senders, subframes, foreign URLs, and invalid paths", async () => {
    let listener: DropListener | undefined;
    const mainFrame = { url: "http://127.0.0.1:49152/" };
    const webContents = { mainFrame };
    const window = { webContents };
    const addFiles = vi.fn(async () => ({ status: "failed" as const }));
    registerHtmlFileDrop({
      addFiles,
      getOwnershipUrl: () => "http://127.0.0.1:49152/",
      getWindow: () => window,
      ipcMain: {
        on: (_channel, next) => {
          listener = next;
        },
      },
      reportResult: vi.fn(),
    });
    const cases: Array<[DropEvent, unknown]> = [
      [{ sender: {}, senderFrame: mainFrame }, ["/tmp/a.html"]],
      [
        { sender: webContents, senderFrame: { url: mainFrame.url } },
        ["/tmp/a.html"],
      ],
      [
        {
          sender: webContents,
          senderFrame: { url: "https://example.com/" },
        },
        ["/tmp/a.html"],
      ],
      [
        {
          sender: webContents,
          senderFrame: { url: "http://127.0.0.1:49152/api/session" },
        },
        ["/tmp/a.html"],
      ],
    ];
    for (const [event, payload] of cases) listener?.(event, payload);
    await Promise.resolve();
    expect(addFiles).not.toHaveBeenCalled();

    listener?.({ sender: webContents, senderFrame: mainFrame }, [
      "relative.html",
    ]);
    await vi.waitFor(() => expect(addFiles).toHaveBeenCalledOnce());
  });
});

interface DropEvent {
  sender: unknown;
  senderFrame: { url: string } | null;
}

type DropListener = (event: DropEvent, payload: unknown) => void;
