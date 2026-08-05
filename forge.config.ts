import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MakerZIP } from "@electron-forge/maker-zip";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import type { ForgeConfig } from "@electron-forge/shared-types";
import zattoPackage from "@yuske-nakajima/zatto/package.json";
import { build } from "esbuild";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

const zattoServerEntry = path.join(
  "node_modules",
  "@yuske-nakajima",
  "zatto",
  "dist",
  "server",
  "index.js",
);
const zattoWebDirectory = path.join(
  "node_modules",
  "@yuske-nakajima",
  "zatto",
  "dist",
  "web",
);

async function bundleZattoServer(buildPath: string): Promise<void> {
  const outputEntry = path.join(buildPath, zattoServerEntry);
  await mkdir(path.dirname(outputEntry), { recursive: true });
  const packageMetadata = `${JSON.stringify({
    type: zattoPackage.type,
    version: zattoPackage.version,
  })}\n`;
  await writeFile(
    path.join(
      buildPath,
      "node_modules",
      "@yuske-nakajima",
      "zatto",
      "package.json",
    ),
    packageMetadata,
  );
  await cp(
    path.resolve(zattoWebDirectory),
    path.join(buildPath, zattoWebDirectory),
    {
      recursive: true,
    },
  );
  await writeFile(
    path.join(path.dirname(outputEntry), "..", "package.json"),
    packageMetadata,
  );
  await build({
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
    bundle: true,
    entryPoints: [path.resolve(zattoServerEntry)],
    format: "esm",
    outfile: outputEntry,
    packages: "bundle",
    platform: "node",
    target: "node24",
  });
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      await bundleZattoServer(buildPath);
    },
  },
  makers: [new MakerZIP({}, ["darwin"])],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/renderer/index.html",
            js: "./src/renderer/index.ts",
            name: "main_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default config;
