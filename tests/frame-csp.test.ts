import { describe, expect, it } from "vitest";

import { createFrameSandboxPolicy } from "../src/main/window-security";

const OWNED_URL = "http://127.0.0.1:43120/";

describe("createFrameSandboxPolicy", () => {
  it.each([
    ["http://127.0.0.1:43120/f/id/", "/f/id/"],
    ["http://127.0.0.1:43120/%66/id/", "/%66/id/"],
    ["http://127.0.0.1:43120/f/id/nested/page.html", "/f/id/nested/"],
  ])(
    "allows assets only below the document directory: %s",
    (url, directory) => {
      const policy = createFrameSandboxPolicy(url, OWNED_URL);
      const source = `http://127.0.0.1:43120${directory}`;

      expect(policy).toContain("sandbox allow-scripts");
      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain(
        `script-src 'unsafe-inline' data: blob: ${source}`,
      );
      expect(policy).toContain(
        `style-src 'unsafe-inline' data: blob: ${source}`,
      );
      expect(policy).toContain(`img-src data: blob: ${source}`);
      expect(policy).toContain(`font-src data: blob: ${source}`);
      expect(policy).toContain(`media-src data: blob: ${source}`);
      expect(policy).toContain("connect-src 'none'");
      expect(policy).toContain("form-action 'none'");
      expect(policy).toContain("base-uri 'none'");
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("frame-src 'none'");
      expect(policy).not.toContain("'self'");
      expect(policy).not.toContain("allow-same-origin");
      expect(policy).not.toContain("allow-top-navigation");
      expect(policy).not.toContain("allow-popups");
      expect(policy).not.toContain("allow-forms");
      expect(policy).not.toContain("https://");
      expect(policy).not.toContain("http://127.0.0.1:43120/api/");
    },
  );

  it.each([
    "http://127.0.0.1:43120/api/session",
    "http://127.0.0.1:43120/%46/id/",
    "http://127.0.0.1:43120/%zz/id/",
  ])("does not grant an asset source to a non-view route: %s", (url) => {
    const policy = createFrameSandboxPolicy(url, OWNED_URL);

    expect(policy).toContain("default-src 'none'");
    expect(policy).not.toContain(OWNED_URL.slice(0, -1));
    expect(policy).toContain("img-src data: blob:");
    expect(policy).toContain("media-src data: blob:");
  });

  it("escapes CSP-delimiting characters in the document directory", () => {
    const policy = createFrameSandboxPolicy(
      "http://127.0.0.1:43120/f/id';script-src%20*/page.html",
      OWNED_URL,
    );

    expect(policy).toContain("/f/id%27%3Bscript-src%20%2A/");
    expect(policy).not.toContain("id';script-src");
  });
});
