import { describe, expect, it, vi } from "vitest";

import { createApplicationMenuTemplate } from "../src/main/html-file-menu";

describe("createApplicationMenuTemplate", () => {
  it("provides the native HTML-file command with Command+O", () => {
    const openFiles = vi.fn();
    const template = createApplicationMenuTemplate(openFiles);
    const fileMenu = template.find((item) => item.label === "ファイル");
    const openItem = Array.isArray(fileMenu?.submenu)
      ? fileMenu.submenu.find(
          (item) => "label" in item && item.label === "HTMLファイルを開く",
        )
      : undefined;

    expect(openItem).toMatchObject({ accelerator: "Command+O" });
    if (openItem !== undefined && "click" in openItem) {
      expect(openItem.click).toBe(openFiles);
    }
    openFiles();
    expect(openFiles).toHaveBeenCalledOnce();
  });
});
