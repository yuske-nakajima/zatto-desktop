import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractFile, statFile } from "@electron/asar";
import { resolvePackagedAppPaths } from "./packaged-app-paths.mjs";

const zattoPackageDirectory = path.join(
  "node_modules",
  "@yuske-nakajima",
  "zatto",
);
const sourcePackagePath = path.resolve(zattoPackageDirectory, "package.json");
const sourceWebDirectory = path.resolve(zattoPackageDirectory, "dist", "web");
const { archivePath } = await resolvePackagedAppPaths();
const sourcePackage = JSON.parse(await readFile(sourcePackagePath, "utf8"));

assertArchiveFile(
  path.join(zattoPackageDirectory, "dist", "server", "index.js"),
);
for (const metadataPath of [
  path.join(zattoPackageDirectory, "package.json"),
  path.join(zattoPackageDirectory, "dist", "package.json"),
]) {
  assertArchiveFile(metadataPath);
  const metadata = JSON.parse(
    extractFile(archivePath, metadataPath).toString(),
  );
  if (
    metadata.type !== "module" ||
    metadata.version !== sourcePackage.version
  ) {
    throw new Error(`Packaged zatto metadata is invalid: ${metadataPath}`);
  }
}

const webFiles = await listRelativeFiles(sourceWebDirectory);
for (const webFile of webFiles) {
  assertArchiveFile(path.join(zattoPackageDirectory, "dist", "web", webFile));
}
if (!webFiles.includes("index.html")) {
  throw new Error("Installed zatto web assets do not contain index.html");
}

console.log(`Packaged zatto contents verified: ${webFiles.length} web files`);

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
