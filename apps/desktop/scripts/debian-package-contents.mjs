import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";

/**
 * Validates the installed command, executable, desktop entry, and icon.
 *
 * @param {object} contents - Values read from the extracted Debian package
 * @param {Buffer} sourceIcon - Branded PNG source bytes
 * @returns {void}
 * @throws {Error} When any installed value differs from the zatto contract
 */
export function validateDebianPackageContents(contents, sourceIcon) {
  if (contents.commandType !== "symlink") {
    throw new Error("Debian zatto command must be a symbolic link");
  }
  const commandTarget = path.posix.resolve(
    "/usr/bin",
    contents.commandLinkTarget,
  );
  if (commandTarget !== "/usr/lib/zatto/zatto") {
    throw new Error("Debian zatto command must target /usr/lib/zatto/zatto");
  }
  if (contents.executableType !== "file") {
    throw new Error("Debian zatto executable must be a regular file");
  }
  if ((contents.executableMode & 0o111) !== 0o111) {
    throw new Error("Debian zatto executable is not executable");
  }
  const desktopEntry = parseDesktopEntry(contents.desktopEntry);
  if (
    desktopEntry.get("Name") !== "zatto" ||
    desktopEntry.get("Exec") !== "zatto %U" ||
    desktopEntry.get("Icon") !== "zatto" ||
    desktopEntry.get("Type") !== "Application"
  ) {
    throw new Error(
      "Debian desktop entry must define Name=zatto, Exec=zatto %U, Icon=zatto, and Type=Application",
    );
  }
  if (!sourceIcon.equals(contents.installedIcon)) {
    throw new Error("Debian PNG icon does not match the branded source");
  }
}

/**
 * Reads and validates the required files from an extracted Debian package.
 *
 * @param {string} directory - Debian package extraction root
 * @param {string} sourceIconPath - Branded PNG source path
 * @returns {Promise<void>} Completion after validation
 * @throws {Error} When a required file is absent or invalid
 */
export async function verifyExtractedDebianPackage(directory, sourceIconPath) {
  const commandPath = path.join(directory, "usr", "bin", "zatto");
  const executablePath = path.join(directory, "usr", "lib", "zatto", "zatto");
  const desktopEntryPath = path.join(
    directory,
    "usr",
    "share",
    "applications",
    "zatto.desktop",
  );
  const iconPath = path.join(directory, "usr", "share", "pixmaps", "zatto.png");
  const [command, commandLinkTarget, executable, desktopEntry, installedIcon] =
    await Promise.all([
      lstat(commandPath),
      readlink(commandPath),
      lstat(executablePath),
      readFile(desktopEntryPath, "utf8"),
      readFile(iconPath),
    ]);
  validateDebianPackageContents(
    {
      commandLinkTarget,
      commandType: fileType(command),
      desktopEntry,
      executableMode: executable.mode,
      executableType: fileType(executable),
      installedIcon,
    },
    await readFile(sourceIconPath),
  );
}

function parseDesktopEntry(source) {
  const values = new Map();
  let isDesktopEntry = false;
  for (const sourceLine of source.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (line.startsWith("[") && line.endsWith("]")) {
      isDesktopEntry = line === "[Desktop Entry]";
    } else if (isDesktopEntry && !line.startsWith("#") && line.includes("=")) {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/\s+/gu, " ");
      values.set(key, value);
    }
  }
  return values;
}

function fileType(statistics) {
  if (statistics.isSymbolicLink()) return "symlink";
  if (statistics.isFile()) return "file";
  return "other";
}
