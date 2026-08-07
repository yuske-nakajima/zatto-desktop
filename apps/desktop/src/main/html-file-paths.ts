import { realpath, stat } from "node:fs/promises";
import path from "node:path";

/** Maximum number of HTML files accepted by one desktop operation. */
export const MAX_HTML_FILE_COUNT = 256;
const MAX_PATH_LENGTH = 32_768;

/** Canonical filesystem validation result for one selected batch. */
export type PreparedHtmlFilePaths =
  | { paths: string[]; status: "ready" }
  | { status: "failed" | "unchanged" };

/** Validates the IPC shape without touching the filesystem. */
export function normalizeHtmlFilePaths(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_HTML_FILE_COUNT) return [];
  const unique = new Set<string>();
  for (const candidate of value) {
    if (!isAbsoluteHtmlPath(candidate)) return [];
    unique.add(candidate);
  }
  return [...unique];
}

/**
 * Resolves aliases and retains only existing regular HTML files.
 *
 * Missing files, directories, and duplicate filesystem identities are ignored.
 * An invalid or oversized payload is rejected as a visible failure.
 */
export async function prepareHtmlFilePaths(
  value: unknown,
): Promise<PreparedHtmlFilePaths> {
  if (!Array.isArray(value) || value.length > MAX_HTML_FILE_COUNT) {
    return { status: "failed" };
  }
  if (value.length === 0) return { status: "unchanged" };
  if (!value.every(isAbsoluteHtmlPath)) return { status: "failed" };

  const canonicalPaths = new Set<string>();
  for (const candidate of value) {
    try {
      const canonicalPath = await realpath(candidate);
      const file = await stat(canonicalPath);
      if (file.isFile() && isAbsoluteHtmlPath(canonicalPath)) {
        canonicalPaths.add(canonicalPath);
      }
    } catch {
      // Files can disappear between Finder selection and validation.
    }
  }
  return canonicalPaths.size === 0
    ? { status: "unchanged" }
    : { paths: [...canonicalPaths], status: "ready" };
}

function isAbsoluteHtmlPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_PATH_LENGTH &&
    path.isAbsolute(value) &&
    [".html", ".htm"].includes(path.extname(value).toLowerCase())
  );
}
