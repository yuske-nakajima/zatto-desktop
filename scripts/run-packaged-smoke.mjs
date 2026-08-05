import { spawn } from "node:child_process";
import { resolvePackagedAppPaths } from "./packaged-app-paths.mjs";

const SMOKE_TIMEOUT_MS = 20_000;
const TERMINATE_TIMEOUT_MS = 3_000;
const KILL_TIMEOUT_MS = 2_000;

const { executablePath } = await resolvePackagedAppPaths();
const child = spawn(executablePath, ["--smoke-test-zatto-server"], {
  stdio: "inherit",
});
const exitPromise = new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve({ code, signal }));
});

const outcome = await waitWithTimeout(exitPromise, SMOKE_TIMEOUT_MS);
if (outcome === null) {
  await terminateChild();
  throw new Error(`Packaged smoke test timed out after ${SMOKE_TIMEOUT_MS}ms`);
}
assertSuccessfulExit(outcome);

async function terminateChild() {
  child.kill("SIGTERM");
  const terminated = await waitWithTimeout(exitPromise, TERMINATE_TIMEOUT_MS);
  if (terminated !== null) return;

  child.kill("SIGKILL");
  const killed = await waitWithTimeout(exitPromise, KILL_TIMEOUT_MS);
  if (killed === null) {
    throw new Error("Packaged smoke test process remained alive after SIGKILL");
  }
}

function assertSuccessfulExit(exit) {
  if (exit.signal) {
    throw new Error(`Packaged smoke test ended with signal ${exit.signal}`);
  }
  if (exit.code !== 0) {
    throw new Error(`Packaged smoke test exited with code ${exit.code}`);
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
