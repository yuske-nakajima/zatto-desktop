import { access, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_ROOT = resolve(SITE_ROOT, "dist");

const requiredFiles = [
  "index.html",
  "ja/index.html",
  "robots.txt",
  "sitemap.xml",
  "zatto-icon.png",
];

await Promise.all(
  requiredFiles.map((file) => access(resolve(DIST_ROOT, file))),
);

const [englishHtml, japaneseHtml, assets] = await Promise.all([
  readFile(resolve(DIST_ROOT, "index.html"), "utf8"),
  readFile(resolve(DIST_ROOT, "ja/index.html"), "utf8"),
  readdir(resolve(DIST_ROOT, "assets")),
]);

if (!assets.some((file) => file.endsWith(".css"))) {
  throw new Error("The site build did not produce a stylesheet asset.");
}

if (assets.some((file) => file.endsWith(".js"))) {
  throw new Error(
    "The static product pages must not require production JavaScript.",
  );
}

for (const html of [englishHtml, japaneseHtml]) {
  if (!html.includes("/assets/") || !html.includes("/zatto-icon.png")) {
    throw new Error(
      "The site build does not reference its generated and public assets.",
    );
  }
}
