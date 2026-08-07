import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveDebianArchitecture,
  resolveDebianPackagePath,
  validateDebianPackageContents,
  withExtractedDebianPackage,
} from "../scripts/debian-package.mjs";

describe("resolveDebianPackagePath", () => {
  const temporaryDirectories = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, {
          force: true,
          recursive: true,
        }),
      ),
    );
  });

  it("resolves the versioned amd64 Debian package", async () => {
    const outputDirectory = await createOutputDirectory();
    const packagePath = path.join(
      outputDirectory,
      "make",
      "deb",
      "x64",
      "zatto_0.1.9_amd64.deb",
    );
    await writeFile(packagePath, "fixture");

    await expect(
      resolveDebianPackagePath(outputDirectory, "0.1.9", "x64"),
    ).resolves.toBe(packagePath);
  });

  it("rejects a missing Debian package", async () => {
    const outputDirectory = await createOutputDirectory();

    await expect(
      resolveDebianPackagePath(outputDirectory, "0.1.9", "x64"),
    ).rejects.toThrow("Expected one Debian package for zatto 0.1.9 amd64");
  });

  async function createOutputDirectory() {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "zatto-debian-output-"),
    );
    temporaryDirectories.push(outputDirectory);
    await mkdir(path.join(outputDirectory, "make", "deb", "x64"), {
      recursive: true,
    });
    return outputDirectory;
  }
});

describe("resolveDebianArchitecture", () => {
  it.each([
    ["x64", "amd64"],
    ["ia32", "i386"],
    ["arm", "armel"],
    ["armv7l", "armhf"],
    ["arm64", "arm64"],
  ])("maps %s to %s", (architecture, expected) => {
    expect(resolveDebianArchitecture(architecture)).toBe(expected);
  });
});

describe("withExtractedDebianPackage", () => {
  it("removes the temporary extraction after the operation fails", async () => {
    const operations = [];
    const dependencies = {
      createExtractionDirectory: vi.fn(async () => "/temporary/debian"),
      extractPackage: vi.fn(async () => operations.push("extract")),
      removeExtractionDirectory: vi.fn(async () => operations.push("remove")),
    };

    await expect(
      withExtractedDebianPackage(
        "/out/zatto.deb",
        async (directory) => {
          operations.push(`operate:${directory}`);
          throw new Error("probe failed");
        },
        dependencies,
      ),
    ).rejects.toThrow("probe failed");
    expect(operations).toEqual([
      "extract",
      "operate:/temporary/debian",
      "remove",
    ]);
  });
});

describe("validateDebianPackageContents", () => {
  const sourceIcon = Buffer.from("branded-icon");
  const validContents = {
    commandLinkTarget: "../lib/zatto/zatto",
    commandType: "symlink",
    desktopEntry:
      "[Desktop Entry]\nName=zatto\nExec=zatto   %U\nIcon=zatto\nType=Application\n\n[Other]\nName=other\n",
    executableMode: 0o100755,
    executableType: "file",
    installedIcon: Buffer.from(sourceIcon),
  };

  it("accepts the exact zatto command, desktop entry, and icon layout", () => {
    expect(() =>
      validateDebianPackageContents(validContents, sourceIcon),
    ).not.toThrow();
  });

  it.each([
    [{ commandType: "file" }, "command must be a symbolic link"],
    [
      { commandLinkTarget: "../lib/other/other" },
      "command must target /usr/lib/zatto/zatto",
    ],
    [{ executableType: "symlink" }, "executable must be a regular file"],
    [{ executableMode: 0o100655 }, "executable is not executable"],
    [{ executableMode: 0o100744 }, "executable is not executable"],
    [
      {
        desktopEntry:
          "[Desktop Entry]\nName=zatto\nExec=/usr/lib/zatto/zatto %U\nIcon=zatto\nType=Application\n",
      },
      "desktop entry must define Name=zatto, Exec=zatto %U, Icon=zatto, and Type=Application",
    ],
    [
      {
        desktopEntry:
          "Name=zatto\nExec=zatto %U\nIcon=zatto\nType=Application\n",
      },
      "desktop entry must define Name=zatto, Exec=zatto %U, Icon=zatto, and Type=Application",
    ],
    [
      {
        desktopEntry:
          "[Other]\nName=zatto\nExec=zatto %U\nIcon=zatto\nType=Application\n",
      },
      "desktop entry must define Name=zatto, Exec=zatto %U, Icon=zatto, and Type=Application",
    ],
    [
      {
        desktopEntry:
          "[Desktop Entry]\nName=zatto\nExec=zatto %U\nIcon=zatto\n",
      },
      "desktop entry must define Name=zatto, Exec=zatto %U, Icon=zatto, and Type=Application",
    ],
    [{ installedIcon: Buffer.from("other") }, "PNG icon does not match"],
  ])("rejects a broken Debian fixture", (overrides, message) => {
    expect(() =>
      validateDebianPackageContents(
        { ...validContents, ...overrides },
        sourceIcon,
      ),
    ).toThrow(message);
  });
});
