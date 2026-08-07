import { describe, expect, it } from "vitest";

import {
  appendFrameSandboxPolicy,
  createFrameSandboxPolicy,
} from "../src/main/window-security";

describe("appendFrameSandboxPolicy", () => {
  it("adds the sandbox policy to owned subframe documents", () => {
    const headers = { "Cache-Control": ["no-store"] };
    const result = appendFrameSandboxPolicy(
      {
        resourceType: "subFrame",
        responseHeaders: headers,
        url: "http://127.0.0.1:43120/f/example/",
      },
      "http://127.0.0.1:43120/",
    );

    expect(result).toEqual({
      "Cache-Control": ["no-store"],
      "Content-Security-Policy": [
        createFrameSandboxPolicy(
          "http://127.0.0.1:43120/f/example/",
          "http://127.0.0.1:43120/",
        ),
      ],
    });
    expect(headers).toEqual({ "Cache-Control": ["no-store"] });
  });

  it.each([
    "http://127.0.0.1:43120/%66/example/",
    "http://127.0.0.1:43120/%46/example/",
    "http://127.0.0.1:43120/%2566/example/",
    "http://127.0.0.1:43120/%zz/example/",
    "http://127.0.0.1:43120/not-a-zatto-frame-route",
  ])(
    "sandboxes every owned subframe without routing assumptions: %s",
    (url) => {
      expect(
        appendFrameSandboxPolicy(
          { resourceType: "subFrame", responseHeaders: {}, url },
          "http://127.0.0.1:43120/",
        ),
      ).toEqual({
        "Content-Security-Policy": [
          createFrameSandboxPolicy(url, "http://127.0.0.1:43120/"),
        ],
      });
    },
  );

  it.each([
    ["mainFrame", "http://127.0.0.1:43120/f/example/"],
    ["script", "http://127.0.0.1:43120/assets/app.js"],
    ["subFrame", "http://127.0.0.1:43121/f/example/"],
  ])("does not alter non-target responses", (resourceType, url) => {
    const headers = { ETag: ["asset"] };
    expect(
      appendFrameSandboxPolicy(
        { resourceType, responseHeaders: headers, url },
        "http://127.0.0.1:43120/",
      ),
    ).toEqual(headers);
  });
});
