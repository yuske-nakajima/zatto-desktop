import type { MakerDebConfig } from "@electron-forge/maker-deb";

/**
 * Builds the metadata used by the Debian package and desktop entry.
 *
 * @param icon - Absolute path to the PNG installed for the application
 * @returns Debian maker configuration
 */
export function resolveLinuxMakerConfig(icon: string): MakerDebConfig {
  return {
    options: {
      bin: "zatto",
      categories: ["Utility"],
      description: "Desktop shell for zatto",
      homepage: "https://github.com/yuske-nakajima/zatto-desktop",
      icon,
      maintainer: "yusuke nakajima",
      name: "zatto",
      productDescription: "View local HTML files together with zatto.",
      productName: "zatto",
      section: "utils",
    },
  };
}
