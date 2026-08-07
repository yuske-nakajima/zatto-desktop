import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import type { ForgeConfig } from "@electron-forge/shared-types";
import zattoPackage from "@yuske-nakajima/zatto/package.json";
import { build } from "esbuild";
import { resolvePlatformIconPath } from "./src/main/platform-assets";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import { resolveWindowsMakerConfig } from "./windows-maker-config";

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
function optionalEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();
  return value === "" ? undefined : value;
}

export function resolveMacosDistributionConfig(
  environment: NodeJS.ProcessEnv,
): ForgeConfig["packagerConfig"] {
  const macosSigningIdentity = optionalEnvironmentValue(
    environment,
    "MACOS_SIGNING_IDENTITY",
  );
  const appleId = optionalEnvironmentValue(environment, "APPLE_ID");
  const appleAppSpecificPassword = optionalEnvironmentValue(
    environment,
    "APPLE_APP_SPECIFIC_PASSWORD",
  );
  const appleTeamId = optionalEnvironmentValue(environment, "APPLE_TEAM_ID");
  const values = {
    APPLE_APP_SPECIFIC_PASSWORD: appleAppSpecificPassword,
    APPLE_ID: appleId,
    APPLE_TEAM_ID: appleTeamId,
    MACOS_SIGNING_IDENTITY: macosSigningIdentity,
  };
  const configuredValues = Object.values(values).filter(
    (value) => value !== undefined,
  );
  if (configuredValues.length === 0) return {};
  const missingNames = Object.entries(values)
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (
    missingNames.length > 0 ||
    appleId === undefined ||
    appleAppSpecificPassword === undefined ||
    appleTeamId === undefined ||
    macosSigningIdentity === undefined
  ) {
    throw new Error(
      `macOS distribution requires environment variables: ${missingNames.join(", ")}`,
    );
  }

  return {
    osxNotarize: {
      appleId,
      appleIdPassword: appleAppSpecificPassword,
      teamId: appleTeamId,
    },
    osxSign: {
      identity: macosSigningIdentity,
      optionsForFile: () => ({ hardenedRuntime: true }),
    },
  };
}

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
    appBundleId: "com.yuskenakajima.zatto-desktop",
    asar: true,
    icon: resolvePlatformIconPath(
      path.resolve("assets/icons/zatto-desktop"),
      process.platform,
    ),
    ...resolveMacosDistributionConfig(process.env),
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      await bundleZattoServer(buildPath);
    },
  },
  makers: [
    new MakerSquirrel(
      resolveWindowsMakerConfig(
        resolvePlatformIconPath(
          path.resolve("assets/icons/zatto-desktop"),
          "win32",
        ),
      ),
      ["win32"],
    ),
    new MakerZIP({}, ["darwin"]),
  ],
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
