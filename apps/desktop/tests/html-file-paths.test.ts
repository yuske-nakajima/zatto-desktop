import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  normalizeHtmlFilePaths,
  prepareHtmlFilePaths,
} from "../src/main/html-file-paths";

describe("normalizeHtmlFilePaths", () => {
  it("keeps unique absolute HTML paths", () => {
    expect(
      normalizeHtmlFilePaths([
        "/tmp/first.html",
        "/tmp/SECOND.HTM",
        "/tmp/first.html",
      ]),
    ).toEqual(["/tmp/first.html", "/tmp/SECOND.HTM"]);
  });

  it.each(["/tmp/readme.txt", "relative.html", "", 42])(
    "rejects a payload containing %j",
    (invalid) => {
      expect(normalizeHtmlFilePaths(["/tmp/first.html", invalid])).toEqual([]);
    },
  );

  it("rejects oversized batches and path strings", () => {
    expect(
      normalizeHtmlFilePaths(Array.from({ length: 257 }, () => "/tmp/a.html")),
    ).toEqual([]);
    expect(normalizeHtmlFilePaths([`/${"a".repeat(32_768)}.html`])).toEqual([]);
  });
});

describe("prepareHtmlFilePaths", () => {
  it("canonicalizes aliases and ignores missing files and directories", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zatto-desktop-files-"));
    const page = join(directory, "page.html");
    const alias = join(directory, "alias.html");
    const folder = join(directory, "folder.html");
    try {
      await writeFile(page, "<!doctype html>", "utf8");
      await symlink(page, alias);
      await mkdir(folder);
      await expect(
        prepareHtmlFilePaths([
          alias,
          page,
          join(directory, "missing.html"),
          folder,
        ]),
      ).resolves.toEqual({
        paths: [await realpath(page)],
        status: "ready",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects an oversized selection explicitly", async () => {
    await expect(
      prepareHtmlFilePaths(
        Array.from({ length: 257 }, (_, index) => `/tmp/${index}.html`),
      ),
    ).resolves.toEqual({ status: "failed" });
  });
});
