import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { MakerZIP } from "@electron-forge/maker-zip";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import type { ForgeConfig } from "@electron-forge/shared-types";
import zattoPackage from "@yuske-nakajima/zatto/package.json";
import { build } from "esbuild";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";

const zattoPackageDirectory = path.join(
  "node_modules",
  "@yuske-nakajima",
  "zatto",
);
const require = createRequire(path.resolve("package.json"));
const sourceZattoPackagePath = require.resolve(
  "@yuske-nakajima/zatto/package.json",
);
const sourceZattoPackageDirectory = path.dirname(sourceZattoPackagePath);
const sourceZattoServerEntry = require.resolve("@yuske-nakajima/zatto/server");
const zattoServerExportPath = path.relative(
  sourceZattoPackageDirectory,
  sourceZattoServerEntry,
);
const sourceZattoWebDirectory = path.join(
  sourceZattoPackageDirectory,
  "dist",
  "web",
);

async function bundleZattoServer(buildPath: string): Promise<void> {
  const outputEntry = path.join(
    buildPath,
    zattoPackageDirectory,
    zattoServerExportPath,
  );
  await mkdir(path.dirname(outputEntry), { recursive: true });
  const packageMetadata = `${JSON.stringify({
    exports: zattoPackage.exports,
    name: zattoPackage.name,
    type: zattoPackage.type,
    version: zattoPackage.version,
  })}\n`;
  const runtimeMetadata = `${JSON.stringify({
    type: zattoPackage.type,
    version: zattoPackage.version,
  })}\n`;
  await writeFile(
    path.join(buildPath, zattoPackageDirectory, "package.json"),
    packageMetadata,
  );
  await cp(
    sourceZattoWebDirectory,
    path.join(buildPath, zattoPackageDirectory, "dist", "web"),
    {
      recursive: true,
    },
  );
  await writeFile(
    path.join(buildPath, zattoPackageDirectory, "dist", "package.json"),
    runtimeMetadata,
  );
  await build({
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
    bundle: true,
    entryPoints: [sourceZattoServerEntry],
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
