import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startServer } from "@yuske-nakajima/zatto/server";
import { describe, expect, it } from "vitest";

import { requestHtmlFileAdd } from "../src/main/html-file-request";

describe("zatto HTML-file add boundary", () => {
  it("posts files, excludes missing and duplicate paths, and publishes a session update", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "zatto-desktop-server-"),
    );
    let server: Awaited<ReturnType<typeof startServer>> = null;
    let socket: WebSocket | undefined;
    try {
      const page = path.join(directory, "page.html");
      await writeFile(page, "<!doctype html><title>Page</title>", "utf8");
      server = await startServer(0, {
        exit: () => undefined,
        instanceId: "zatto-desktop-html-file-test",
        runtimeFilePath: path.join(directory, "runtime", "server.json"),
        sessionFilePath: path.join(directory, "session", "session.json"),
      });
      if (server === null) throw new Error("test server lock is unavailable");
      socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
      await waitForSocketOpen(socket);
      const update = waitForSocketMessage(socket);
      const first = await requestHtmlFileAdd(
        `http://127.0.0.1:${server.port}/api/session/add`,
        [page, path.join(directory, "missing.html")],
        AbortSignal.timeout(5_000),
      );
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        added: [{ absPath: page, title: "Page" }],
      });
      await expect(update).resolves.toMatchObject({
        entries: [{ absPath: page, title: "Page" }],
        type: "session:update",
      });

      const duplicate = await requestHtmlFileAdd(
        `http://127.0.0.1:${server.port}/api/session/add`,
        [page],
        AbortSignal.timeout(5_000),
      );
      expect(duplicate).toMatchObject({ body: { added: [] }, status: 201 });
      expect(server.sessionStore.getSession().entries).toHaveLength(1);
    } finally {
      socket?.close();
      await server?.app.close();
      await rm(directory, { force: true, recursive: true });
    }
  });
});

function waitForSocketOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("open timed out")),
      2_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("open failed"));
      },
      { once: true },
    );
  });
}

function waitForSocketMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("message timed out")),
      2_000,
    );
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(String(event.data)));
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
  });
}
