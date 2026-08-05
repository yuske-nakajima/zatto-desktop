import { describe, expect, it } from "vitest";

import { isAllowedOwnedNavigation } from "../src/main/window-security";

describe("isAllowedOwnedNavigation", () => {
  const ownedUrl = "http://127.0.0.1:43120/";

  it.each([
    "http://localhost:43120/",
    "http://127.0.0.1:43121/",
    "http://user@127.0.0.1:43120/",
    "https://127.0.0.1:43120/",
    "https://example.com/",
    "not a URL",
  ])("rejects a URL outside the validated ownership origin: %s", (url) => {
    expect(isAllowedOwnedNavigation(url, ownedUrl)).toBe(false);
  });

  it("allows owned main and frame routes", () => {
    expect(isAllowedOwnedNavigation(ownedUrl, ownedUrl)).toBe(true);
    expect(
      isAllowedOwnedNavigation("http://127.0.0.1:43120/f/example/", ownedUrl),
    ).toBe(true);
  });
});
