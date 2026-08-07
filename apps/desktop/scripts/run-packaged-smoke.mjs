import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { withPackagedSmokeExecutable } from "./packaged-smoke-executable.mjs";

const SMOKE_TIMEOUT_MS = 20_000;
const TERMINATE_TIMEOUT_MS = 3_000;
const KILL_TIMEOUT_MS = 2_000;

const packageMetadata = JSON.parse(
  await readFile(path.resolve("package.json"), "utf8"),
);
await withPackagedSmokeExecutable(
  {
    architecture: process.arch,
    outputDirectory: path.resolve("out"),
    platform: process.platform,
    version: packageMetadata.version,
  },
  async (executablePath) => {
    await runExecutableProbe(executablePath, "--smoke-test-zatto-server");
    if (process.platform === "linux") {
      await runExecutableProbe(executablePath, "--smoke-test-window-lifecycle");
    }
  },
);

async function runExecutableProbe(executablePath, probeArgument) {
  const child = spawn(executablePath, [probeArgument], {
    stdio: "inherit",
  });
  const exitPromise = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  const outcome = await waitWithTimeout(exitPromise, SMOKE_TIMEOUT_MS);
  if (outcome === null) {
    await terminateChild(child, exitPromise);
    throw new Error(
      `Packaged smoke test ${probeArgument} timed out after ${SMOKE_TIMEOUT_MS}ms`,
    );
  }
  assertSuccessfulExit(outcome, probeArgument);
}

async function terminateChild(child, exitPromise) {
  child.kill("SIGTERM");
  const terminated = await waitWithTimeout(exitPromise, TERMINATE_TIMEOUT_MS);
  if (terminated !== null) return;

  child.kill("SIGKILL");
  const killed = await waitWithTimeout(exitPromise, KILL_TIMEOUT_MS);
  if (killed === null) {
    throw new Error("Packaged smoke test process remained alive after SIGKILL");
  }
}

function assertSuccessfulExit(exit, probeArgument) {
  if (exit.signal) {
    throw new Error(
      `Packaged smoke test ${probeArgument} ended with signal ${exit.signal}`,
    );
  }
  if (exit.code !== 0) {
    throw new Error(
      `Packaged smoke test ${probeArgument} exited with code ${exit.code}`,
    );
  }
}

function waitWithTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
