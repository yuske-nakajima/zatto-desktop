import { existsSync } from "node:fs";
import path from "node:path";

export function findRepositoryRoot(startDirectory = process.cwd()): string {
  let directory = path.resolve(startDirectory);
  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error("Repository workspace root is unavailable");
    }
    directory = parent;
  }
  return directory;
}
