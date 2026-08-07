import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMacosDistributionConfig } from "../forge.config";
import { findRepositoryRoot } from "./repository-root";

const repositoryRoot = findRepositoryRoot();
const repositoryFile = (relativePath: string) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

describe("macOS release workflow", () => {
  it("runs the complete release verification from main", async () => {
    const workflow = await repositoryFile(".github/workflows/release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('github.ref == "refs/heads/main"');
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("pnpm check");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm smoke:dev");
    expect(workflow).toContain("pnpm make");
    expect(workflow).toContain("pnpm smoke:packaged");
    expect(workflow).toContain("codesign --verify --deep --strict");
    expect(workflow).toContain("spctl --assess --type execute");
    expect(workflow).toMatch(
      /\*-\$\{\{ steps\.release\.outputs\.version \}\}\.zip/,
    );
    expect(workflow).toContain("gh release create");
  });

  it("keeps signing credentials in GitHub Secrets", async () => {
    const [workflow, forgeConfig, readme] = await Promise.all([
      repositoryFile(".github/workflows/release.yml"),
      repositoryFile("apps/desktop/forge.config.ts"),
      repositoryFile("README.md"),
    ]);
    const secretNames = [
      "MACOS_CERTIFICATE_P12",
      "MACOS_CERTIFICATE_PASSWORD",
      "MACOS_SIGNING_IDENTITY",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
    ];

    for (const secretName of secretNames) {
      expect(workflow).toContain(`secrets.${secretName}`);
      expect(readme).toContain(`\`${secretName}\``);
    }
    expect(forgeConfig).toContain(
      'appBundleId: "com.yuskenakajima.zatto-desktop"',
    );
    expect(forgeConfig).toContain('"MACOS_SIGNING_IDENTITY"');
    expect(forgeConfig).toContain("hardenedRuntime: true");
    expect(forgeConfig).toContain("osxNotarize");
    expect(forgeConfig).toContain('"APPLE_APP_SPECIFIC_PASSWORD"');
  });

  it("enables signing only with a complete distribution environment", () => {
    expect(resolveMacosDistributionConfig({})).toEqual({});
    expect(() =>
      resolveMacosDistributionConfig({
        MACOS_SIGNING_IDENTITY: "Developer ID",
      }),
    ).toThrow(/APPLE_APP_SPECIFIC_PASSWORD, APPLE_ID, APPLE_TEAM_ID/);

    expect(
      resolveMacosDistributionConfig({
        APPLE_APP_SPECIFIC_PASSWORD: "app-password",
        APPLE_ID: "developer@example.com",
        APPLE_TEAM_ID: "TEAMID",
        MACOS_SIGNING_IDENTITY: "Developer ID",
      }),
    ).toMatchObject({
      osxNotarize: {
        appleId: "developer@example.com",
        appleIdPassword: "app-password",
        teamId: "TEAMID",
      },
      osxSign: { identity: "Developer ID" },
    });
  });
});
