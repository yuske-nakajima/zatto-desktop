import { Menu, type MenuItemConstructorOptions } from "electron";

/**
 * Builds the macOS application menu containing the HTML-file open command.
 *
 * @param openFiles - Operation invoked by the menu item or Command+O
 * @returns Electron menu template
 */
export function createApplicationMenuTemplate(
  openFiles: () => void,
): MenuItemConstructorOptions[] {
  return [
    { role: "appMenu" },
    {
      label: "ファイル",
      submenu: [
        {
          accelerator: "Command+O",
          click: openFiles,
          label: "HTMLファイルを開く",
        },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
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
