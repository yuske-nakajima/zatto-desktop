import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("static site assets", () => {
  it("provides crawler files and local presentation assets", async () => {
    const [
      robots,
      sitemap,
      icon,
      wordmark,
      baseStyles,
      layoutStyles,
      componentStyles,
      responsiveStyles,
    ] = await Promise.all([
      readFile(resolve(SITE_ROOT, "public/robots.txt"), "utf8"),
      readFile(resolve(SITE_ROOT, "public/sitemap.xml"), "utf8"),
      readFile(resolve(SITE_ROOT, "public/zatto-icon.png")),
      readFile(resolve(SITE_ROOT, "public/zatto-wordmark.png")),
      readFile(resolve(SITE_ROOT, "styles/base.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/layout.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/components.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/responsive.css"), "utf8"),
    ]);

    expect(robots).toContain("Sitemap: https://zatto.yuske.app/sitemap.xml");
    expect(sitemap).toContain("https://zatto.yuske.app/ja/");
    expect(icon.subarray(1, 4).toString()).toBe("PNG");
    expect(wordmark.subarray(1, 4).toString()).toBe("PNG");
    for (const variable of [
      "--color-text-tertiary: #94a3b8",
      "--color-text-accent: #4f46e5",
      "--color-bg-surface: #ffffff",
      "--color-text-inverse: #ffffff",
      "--color-bg-accent: #4f46e5",
      "--color-text-primary: #0f172a",
      "--color-text-secondary: #64748b",
      "--color-bg-selected: #eef2ff",
      "--color-bg-app: #f8fafc",
    ]) {
      expect(baseStyles).toContain(variable);
    }
    expect(baseStyles).toContain(":focus-visible");
    expect(layoutStyles).toContain("min-height: 44px");
    expect(responsiveStyles).toContain("prefers-reduced-motion");
    expect(responsiveStyles).toContain("forced-colors");
    expect(componentStyles.length).toBeGreaterThan(100);
  });
});
