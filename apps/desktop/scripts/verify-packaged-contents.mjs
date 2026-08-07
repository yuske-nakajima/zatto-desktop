import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { extractFile, statFile } from "@electron/asar";
import { resolvePackagedAppPaths } from "./packaged-app-paths.mjs";

const zattoPackageDirectory = path.join(
  "node_modules",
  "@yuske-nakajima",
  "zatto",
);
const require = createRequire(path.resolve("package.json"));
const sourcePackagePath = require.resolve("@yuske-nakajima/zatto/package.json");
const sourcePackageDirectory = path.dirname(sourcePackagePath);
const sourceServerEntry = require.resolve("@yuske-nakajima/zatto/server");
const serverExportPath = path.relative(
  sourcePackageDirectory,
  sourceServerEntry,
);
const sourceWebDirectory = path.join(sourcePackageDirectory, "dist", "web");
const { archivePath, iconPath } = await resolvePackagedAppPaths();
const sourcePackage = JSON.parse(await readFile(sourcePackagePath, "utf8"));
if (iconPath !== undefined) {
  const sourceIconPath = path.resolve("assets/icons/zatto-desktop.icns");
  const [sourceIcon, packagedIcon] = await Promise.all([
    readFile(sourceIconPath),
    readFile(iconPath),
  ]);
  if (!sourceIcon.equals(packagedIcon)) {
    throw new Error("Packaged application does not contain the branded icon");
  }
}

const preloadBundlePath = path.join(
  ".webpack",
  "renderer",
  "main_window",
  "preload.js",
);
assertArchiveFile(preloadBundlePath);
const preloadBundle = extractFile(archivePath, preloadBundlePath);
const preloadSource = preloadBundle.toString();
const requiredPreloadTokens = [
  "zatto-desktop:drop-html-files",
  "getPathForFile",
  "dragover",
  "dragenter",
  "dragleave",
  "drop",
  "zatto-desktop-drop-shield",
  "prefers-reduced-motion",
  "send",
];
if (
  preloadBundle.byteLength === 0 ||
  requiredPreloadTokens.some((token) => !preloadSource.includes(token))
) {
  throw new Error(
    "Packaged preload bundle does not contain restricted drop IPC",
  );
}

const packagedServerEntry = path.join(zattoPackageDirectory, serverExportPath);
assertArchiveFile(packagedServerEntry);
if (extractFile(archivePath, packagedServerEntry).byteLength === 0) {
  throw new Error("Packaged zatto server export is empty");
}

const metadataPath = path.join(zattoPackageDirectory, "package.json");
assertArchiveFile(metadataPath);
const metadata = JSON.parse(extractFile(archivePath, metadataPath).toString());
if (
  metadata.name !== sourcePackage.name ||
  metadata.type !== "module" ||
  metadata.version !== sourcePackage.version ||
  !isDeepStrictEqual(metadata.exports, sourcePackage.exports)
) {
  throw new Error(`Packaged zatto metadata is invalid: ${metadataPath}`);
}

const runtimeMetadataPath = path.join(
  zattoPackageDirectory,
  "dist",
  "package.json",
);
assertArchiveFile(runtimeMetadataPath);
const runtimeMetadata = JSON.parse(
  extractFile(archivePath, runtimeMetadataPath).toString(),
);
if (
  runtimeMetadata.type !== "module" ||
  runtimeMetadata.version !== sourcePackage.version
) {
  throw new Error(
    `Packaged zatto runtime metadata is invalid: ${runtimeMetadataPath}`,
  );
}

const webFiles = await listRelativeFiles(sourceWebDirectory);
for (const webFile of webFiles) {
  assertArchiveFile(path.join(zattoPackageDirectory, "dist", "web", webFile));
}
if (!webFiles.includes("index.html")) {
  throw new Error("Installed zatto web assets do not contain index.html");
}

console.log(
  `Packaged zatto contents, icon, and restricted preload verified: ${webFiles.length} web files`,
);

function assertArchiveFile(relativePath) {
  try {
    statFile(archivePath, relativePath);
  } catch (error) {
    throw new Error(`Packaged application is missing ${relativePath}`, {
      cause: error,
    });
  }
}

async function listRelativeFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...(await listRelativeFiles(
          path.join(directory, entry.name),
          relativePath,
        )),
      );
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}
