import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyExtractedDebianPackage } from "./debian-package-contents.mjs";

export { validateDebianPackageContents } from "./debian-package-contents.mjs";

const DEBIAN_ARCHITECTURES = {
  arm: "armel",
  arm64: "arm64",
  armv7l: "armhf",
  ia32: "i386",
  x64: "amd64",
};

/**
 * Maps an Electron architecture to its Debian architecture name.
 *
 * @param {string} architecture - Electron target architecture
 * @returns {string} Debian architecture name
 * @throws {Error} When the architecture is unsupported
 */
export function resolveDebianArchitecture(architecture) {
  const debianArchitecture = DEBIAN_ARCHITECTURES[architecture];
  if (debianArchitecture === undefined) {
    throw new Error(`Unsupported Debian architecture: ${architecture}`);
  }
  return debianArchitecture;
}

/**
 * Resolves the Debian package produced for one application version.
 *
 * @param {string} outputDirectory - Forge output directory
 * @param {string} version - Desktop application version
 * @param {string} architecture - Electron target architecture
 * @returns {Promise<string>} Absolute Debian package path
 * @throws {Error} When the architecture is unsupported or the package is absent
 */
export async function resolveDebianPackagePath(
  outputDirectory,
  version,
  architecture,
) {
  const debianArchitecture = resolveDebianArchitecture(architecture);
  const packageDirectory = path.join(
    outputDirectory,
    "make",
    "deb",
    architecture,
  );
  const expectedName = `zatto_${version}_${debianArchitecture}.deb`;
  const entries = await readdir(packageDirectory, { withFileTypes: true });
  const packages = entries.filter(
    (entry) => entry.isFile() && entry.name === expectedName,
  );
  if (packages.length !== 1) {
    throw new Error(
      `Expected one Debian package for zatto ${version} ${debianArchitecture}, found ${packages.length}`,
    );
  }
  return path.join(packageDirectory, packages[0].name);
}

/**
 * Verifies Debian control metadata, desktop entry, command, and PNG icon.
 *
 * @param {string} packagePath - Debian package to inspect
 * @param {string} expectedVersion - Required package version
 * @param {string} expectedArchitecture - Required Debian architecture
 * @param {string} sourceIconPath - Source PNG expected in the package
 * @returns {Promise<void>} Completion after every package assertion succeeds
 * @throws {Error} When package metadata or installed files are invalid
 */
export async function verifyDebianPackage(
  packagePath,
  expectedVersion,
  expectedArchitecture,
  sourceIconPath,
) {
  const fields = await Promise.all(
    ["Package", "Version", "Architecture"].map((field) =>
      runDpkgDeb(["--field", packagePath, field]),
    ),
  );
  const expectedFields = ["zatto", expectedVersion, expectedArchitecture];
  if (fields.some((field, index) => field.trim() !== expectedFields[index])) {
    throw new Error(
      `Debian package metadata is invalid: ${fields.map((field) => field.trim()).join(", ")}`,
    );
  }
  await withExtractedDebianPackage(packagePath, async (directory) => {
    await verifyExtractedDebianPackage(directory, sourceIconPath);
  });
}

/**
 * Runs an operation against a temporary Debian extraction and always removes it.
 *
 * @template T
 * @param {string} packagePath - Debian package to extract
 * @param {(directory: string) => Promise<T>} operation - Extraction consumer
 * @param {object} dependencies - Temporary-directory and extraction adapters
 * @returns {Promise<T>} Operation result
 * @throws {Error} From extraction, the operation, or cleanup
 */
export async function withExtractedDebianPackage(
  packagePath,
  operation,
  dependencies = defaultExtractionDependencies,
) {
  const directory = await dependencies.createExtractionDirectory();
  try {
    await dependencies.extractPackage(packagePath, directory);
    return await operation(directory);
  } finally {
    await dependencies.removeExtractionDirectory(directory);
  }
}

const defaultExtractionDependencies = {
  createExtractionDirectory: () =>
    mkdtemp(path.join(tmpdir(), "zatto-debian-package-")),
  extractPackage: (packagePath, directory) =>
    runDpkgDeb(["--extract", packagePath, directory]),
  removeExtractionDirectory: (directory) =>
    rm(directory, { force: true, recursive: true }),
};

async function runDpkgDeb(arguments_) {
  const child = spawn("dpkg-deb", arguments_, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`dpkg-deb ended with signal ${signal}`));
        return;
      }
      resolve(code);
    });
  });
  if (exitCode !== 0) {
    throw new Error(
      `dpkg-deb exited with code ${exitCode}: ${Buffer.concat(stderr).toString().trim()}`,
    );
  }
  return Buffer.concat(stdout).toString();
}
