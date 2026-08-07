import { describe, expect, it, vi } from "vitest";

import { chooseHtmlFiles } from "../src/main/html-file-dialog";

describe("chooseHtmlFiles", () => {
  it("opens a multi-select HTML dialog and forwards selected paths", async () => {
    const addFiles = vi.fn(async () => ({
      addedCount: 2,
      display: "shown" as const,
      status: "added" as const,
    }));
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: ["/tmp/a.html", "/tmp/b.htm"],
    }));
    const window = { id: 1 };

    await expect(
      chooseHtmlFiles(window, { addFiles, showOpenDialog }),
    ).resolves.toEqual({
      addedCount: 2,
      display: "shown",
      status: "added",
    });
    expect(showOpenDialog).toHaveBeenCalledWith(window, {
      filters: [{ extensions: ["html", "htm"], name: "HTML Files" }],
      properties: ["openFile", "multiSelections"],
      title: "HTMLファイルを開く",
    });
    expect(addFiles).toHaveBeenCalledWith(["/tmp/a.html", "/tmp/b.htm"]);
  });

  it("returns cancelled without invoking the add service", async () => {
    const addFiles = vi.fn();
    await expect(
      chooseHtmlFiles(
        {},
        {
          addFiles,
          showOpenDialog: vi.fn(async () => ({
            canceled: true,
            filePaths: [],
          })),
        },
      ),
    ).resolves.toEqual({ status: "cancelled" });
    expect(addFiles).not.toHaveBeenCalled();
  });
});
