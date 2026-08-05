import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const manifestPath = require.resolve("@electron-forge/cli/package.json");
const manifest = require(manifestPath);
const executable = manifest.bin?.["electron-forge"];

if (typeof executable !== "string") {
  throw new Error("Electron Forge does not declare the electron-forge bin");
}

const executablePath = path.resolve(path.dirname(manifestPath), executable);
const child = spawn(
  process.execPath,
  [executablePath, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`Electron Forge ended with signal ${signal}`));
      return;
    }
    resolve(code);
  });
});

if (exitCode !== 0) {
  throw new Error(`Electron Forge exited with code ${exitCode}`);
}
