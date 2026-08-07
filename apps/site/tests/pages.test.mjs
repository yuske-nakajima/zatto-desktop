import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_URL = "https://github.com/yuske-nakajima/zatto-desktop";
const REQUIRED_EXTERNAL_LINKS = [
  REPOSITORY_URL,
  `${REPOSITORY_URL}/issues`,
  `${REPOSITORY_URL}/releases`,
  `${REPOSITORY_URL}/actions/workflows/ci.yml`,
  "https://github.com/yuske-nakajima/zatto/blob/main/LICENSE",
];

const PAGE_CASES = [
  {
    file: "index.html",
    lang: "en",
    canonical: "https://zatto.yuske.app/",
    languageHref: "/ja/",
    status: "Download preparation in progress",
    featurePatterns: [/HTML files/i, /drag and drop/i, /CLI and desktop/i],
  },
  {
    file: "ja/index.html",
    lang: "ja",
    canonical: "https://zatto.yuske.app/ja/",
    languageHref: "/",
    status: "ダウンロード準備中",
    featurePatterns: [
      /HTMLファイル/,
      /ドラッグ＆ドロップ/,
      /CLIとデスクトップ/,
    ],
  },
];

async function loadPage(file) {
  const html = await readFile(resolve(SITE_ROOT, file), "utf8");
  return new JSDOM(html, { url: `https://zatto.yuske.app/${file}` }).window
    .document;
}

function getMeta(document, selector) {
  return document.querySelector(selector)?.getAttribute("content") ?? "";
}

function getAccessibleName(element) {
  return (
    element.getAttribute("aria-label")?.trim() ||
    element.getAttribute("title")?.trim() ||
    element.textContent?.trim() ||
    ""
  );
}

describe.each(PAGE_CASES)("$lang product page", (page) => {
  it("provides localized SEO and social metadata", async () => {
    const document = await loadPage(page.file);
    const alternates = Object.fromEntries(
      [...document.querySelectorAll('link[rel="alternate"]')].map((link) => [
        link.getAttribute("hreflang"),
        link.getAttribute("href"),
      ]),
    );

    expect(document.documentElement.lang).toBe(page.lang);
    expect(document.title.trim()).not.toBe("");
    expect(getMeta(document, 'meta[name="description"]')).not.toBe("");
    expect(document.querySelector('link[rel="canonical"]')?.href).toBe(
      page.canonical,
    );
    expect(alternates).toEqual({
      en: "https://zatto.yuske.app/",
      ja: "https://zatto.yuske.app/ja/",
      "x-default": "https://zatto.yuske.app/",
    });
    expect(getMeta(document, 'meta[property="og:url"]')).toBe(page.canonical);
    expect(getMeta(document, 'meta[property="og:image"]')).toBe(
      "https://zatto.yuske.app/zatto-icon.png",
    );
    expect(getMeta(document, 'meta[name="twitter:card"]')).toBe("summary");
    expect(getMeta(document, 'meta[name="theme-color"]')).toMatch(
      /^#[0-9a-f]{6}$/i,
    );
    expect(
      document.querySelector('link[rel="icon"]')?.getAttribute("href"),
    ).toBe("/zatto-icon.png");
    expect(
      document.querySelector('link[rel="apple-touch-icon"]'),
    ).not.toBeNull();
  });

  it("uses semantic landmarks and accessible controls", async () => {
    const document = await loadPage(page.file);
    const main = document.querySelector("main#main-content");
    const headings = [...document.querySelectorAll("h1, h2, h3")].map(
      (heading) => Number(heading.tagName.slice(1)),
    );

    expect(document.querySelector("header")).not.toBeNull();
    expect(document.querySelector("nav[aria-label]")).not.toBeNull();
    expect(main).not.toBeNull();
    expect(document.querySelector("footer")).not.toBeNull();
    expect(document.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(headings[0]).toBe(1);
    headings.slice(1).forEach((level, index) => {
      expect(level - headings[index]).toBeLessThanOrEqual(1);
    });

    for (const element of document.querySelectorAll("a, button")) {
      expect(getAccessibleName(element)).not.toBe("");
    }
    for (const image of document.images) {
      expect(image.hasAttribute("alt")).toBe(true);
    }
    for (const link of document.querySelectorAll('a[target="_blank"]')) {
      expect(link.rel.split(/\s+/)).toEqual(
        expect.arrayContaining(["noopener", "noreferrer"]),
      );
    }
    expect(
      document.querySelector(`a[href="${page.languageHref}"]`),
    ).not.toBeNull();
  });

  it("describes the product and honest platform availability", async () => {
    const document = await loadPage(page.file);
    const text = document.body.textContent?.replace(/\s+/g, " ") ?? "";

    for (const pattern of page.featurePatterns) {
      expect(text).toMatch(pattern);
    }
    for (const platform of ["macOS", "Windows", "Linux"]) {
      const section = document.querySelector(`[data-platform="${platform}"]`);
      expect(section?.textContent).toContain(page.status);
    }
    expect(document.querySelector("[download]")).toBeNull();
    expect(
      document.querySelector('a[href*="/releases"]')?.textContent,
    ).not.toMatch(/^\s*download/i);
  });

  it("links to support, distribution, and the CLI MIT license", async () => {
    const document = await loadPage(page.file);
    const hrefs = [...document.links].map((link) =>
      link.href.replace(/\/$/, ""),
    );

    for (const url of REQUIRED_EXTERNAL_LINKS) {
      expect(hrefs).toContain(url);
    }
  });
});

describe("static site assets", () => {
  it("provides crawler files and local presentation assets", async () => {
    const [
      robots,
      sitemap,
      icon,
      baseStyles,
      layoutStyles,
      componentStyles,
      responsiveStyles,
    ] = await Promise.all([
      readFile(resolve(SITE_ROOT, "public/robots.txt"), "utf8"),
      readFile(resolve(SITE_ROOT, "public/sitemap.xml"), "utf8"),
      readFile(resolve(SITE_ROOT, "public/zatto-icon.png")),
      readFile(resolve(SITE_ROOT, "styles/base.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/layout.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/components.css"), "utf8"),
      readFile(resolve(SITE_ROOT, "styles/responsive.css"), "utf8"),
    ]);

    expect(robots).toContain("Sitemap: https://zatto.yuske.app/sitemap.xml");
    expect(sitemap).toContain("https://zatto.yuske.app/ja/");
    expect(icon.subarray(1, 4).toString()).toBe("PNG");
    expect(baseStyles).toContain(":focus-visible");
    expect(layoutStyles).toContain("min-height: 44px");
    expect(responsiveStyles).toContain("prefers-reduced-motion");
    expect(responsiveStyles).toContain("forced-colors");
    expect(componentStyles.length).toBeGreaterThan(100);
  });
});
