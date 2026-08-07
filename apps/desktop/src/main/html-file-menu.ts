import { Menu, type MenuItemConstructorOptions } from "electron";

/**
 * Builds the platform application menu containing the HTML-file open command.
 *
 * @param openFiles - Operation invoked by the menu item or keyboard shortcut
 * @param platform - Node.js platform identifier
 * @returns Electron menu template
 */
export function createApplicationMenuTemplate(
  openFiles: () => void,
  platform: NodeJS.Platform = process.platform,
): MenuItemConstructorOptions[] {
  const menus: MenuItemConstructorOptions[] = [
    {
      label: "ファイル",
      submenu: [
        {
          accelerator: "CommandOrControl+O",
          click: openFiles,
          label: "HTMLファイルを開く",
        },
        { role: platform === "darwin" ? "close" : "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  return platform === "darwin" ? [{ role: "appMenu" }, ...menus] : menus;
}

/**
 * Installs the native application menu.
 *
 * @param openFiles - Operation invoked by file selection
 * @returns Nothing
 * @throws When Electron cannot construct or install the menu
 */
export function installApplicationMenu(openFiles: () => void): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(createApplicationMenuTemplate(openFiles)),
  );
}
