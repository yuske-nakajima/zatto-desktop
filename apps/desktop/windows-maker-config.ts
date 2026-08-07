import type { MakerSquirrelConfig } from "@electron-forge/maker-squirrel";

const WINDOWS_ICON_URL =
  "https://raw.githubusercontent.com/yuske-nakajima/zatto-desktop/24ec9e9c37a731d8d15b9067dcaf22aaddc1e91f/apps/desktop/assets/icons/zatto-desktop.ico";

/**
 * Builds the metadata used by the Windows installer and installed application.
 *
 * @param setupIcon - Absolute path to the ICO embedded in the installer
 * @returns Squirrel.Windows maker configuration
 */
export function resolveWindowsMakerConfig(
  setupIcon: string,
): MakerSquirrelConfig {
  return {
    authors: "yusuke nakajima",
    description: "View local HTML files together with zatto.",
    exe: "zatto.exe",
    iconUrl: WINDOWS_ICON_URL,
    name: "zatto",
    noMsi: true,
    setupExe: "zatto-Setup.exe",
    setupIcon,
    title: "zatto",
  };
}
