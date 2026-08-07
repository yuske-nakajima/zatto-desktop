import { describe, expect, it, vi } from "vitest";

import { createApplicationMenuTemplate } from "../src/main/html-file-menu";

describe("createApplicationMenuTemplate", () => {
  it.each(["darwin", "win32", "linux"] as const)(
    "provides the native HTML-file command on %s",
    (platform) => {
      const openFiles = vi.fn();
      const template = createApplicationMenuTemplate(openFiles, platform);
      const fileMenu = template.find((item) => item.label === "ファイル");
      const openItem = Array.isArray(fileMenu?.submenu)
        ? fileMenu.submenu.find(
            (item) => "label" in item && item.label === "HTMLファイルを開く",
          )
        : undefined;

      expect(openItem).toMatchObject({ accelerator: "CommandOrControl+O" });
      if (openItem !== undefined && "click" in openItem) {
        expect(openItem.click).toBe(openFiles);
      }
      openFiles();
      expect(openFiles).toHaveBeenCalledOnce();
    },
  );

  it("uses the application menu and close role only on macOS", () => {
    const macMenu = createApplicationMenuTemplate(vi.fn(), "darwin");
    const windowsMenu = createApplicationMenuTemplate(vi.fn(), "win32");

    expect(macMenu[0]).toMatchObject({ role: "appMenu" });
    expect(windowsMenu.some((item) => item.role === "appMenu")).toBe(false);
    expect(findFileRole(macMenu)).toBe("close");
    expect(findFileRole(windowsMenu)).toBe("quit");
  });
});

function findFileRole(
  template: ReturnType<typeof createApplicationMenuTemplate>,
) {
  const fileMenu = template.find((item) => item.label === "ファイル");
  if (!Array.isArray(fileMenu?.submenu)) return undefined;
  return fileMenu.submenu.find(
    (item) => "role" in item && (item.role === "close" || item.role === "quit"),
  )?.role;
}
