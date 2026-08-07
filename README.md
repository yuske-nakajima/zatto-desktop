# zatto

<p align="center">
  <img src="apps/desktop/assets/icons/zatto-desktop.png" alt="zatto application icon" width="160" height="160" />
</p>

[日本語](./README.ja.md)

`zatto` is a local viewer that brings multiple HTML files together in one session.
This repository contains the desktop app for `zatto`.
The command-line version is available in the
[`yuske-nakajima/zatto`](https://github.com/yuske-nakajima/zatto) repository.
Both are `zatto`; desktop describes how this version is distributed and used.

## Platform support

- macOS: available from GitHub Releases
- Windows: planned
- Linux: planned

## Install

Download the latest macOS ZIP from
[GitHub Releases](https://github.com/yuske-nakajima/zatto-desktop/releases),
extract it, and move the application into `Applications`.

Open the application from Finder.
The `zatto` viewer appears after a short preparation screen.

## Add HTML files

Add one or more `.html` or `.htm` files in any of these ways:

- choose **File > Open HTML Files**
- press <kbd>Command</kbd>+<kbd>O</kbd> on macOS or <kbd>Ctrl</kbd>+<kbd>O</kbd> on Windows and Linux
- drag files from your file manager and drop them anywhere in the window

The first added file opens immediately.
Use the file panel in `zatto` to switch between files.
Relative assets continue to work because the desktop app passes the original file locations
to its private local server.

The app accepts up to 256 files in one operation.
Duplicate files, missing files, directories, and entries that are not regular files are skipped.
Symbolic links that resolve to the same file are treated as one file.
If the limit is exceeded, no files are added and an error is displayed.

## Continue where you left off

The file session, window position, size, maximized state, and full-screen state are restored
when the app starts again.
Saved window positions outside the available displays are corrected automatically.

The full-window drop indicator stays above HTML previews so files can be dropped across the
entire window. Its motion is reduced when reduced motion is enabled in the operating system.

## Development

The following sections are for contributors working on the desktop app.

### Repository layout

This repository is a pnpm workspace.

- `apps/desktop`: Electron desktop application
- `apps/site`: product site workspace added with the site implementation

Shared mise, pnpm, TypeScript, Biome, CI, and Release settings remain at the repository root.
Run the documented commands from the repository root.

### Setup

Development currently requires macOS and [mise](https://mise.jdx.dev/).
`.mise.toml` pins Node.js 24.18.0 and pnpm 11.17.0.

```sh
mise install
pnpm install --frozen-lockfile
```

Static analysis uses TypeScript 7.0.2 and Biome 2.5.5.
Electron Forge dependencies include packages installed through Git.
`pnpm-workspace.yaml` disables `blockExoticSubdeps` so Forge can collect those dependencies.
The pnpm dependency layout is pinned to hoisted, and minimum-release-age exclusions are
limited to the required packages and metadata.

Type checking, unit tests, and the development smoke test also pass on Node.js 26.6.0.
Electron Forge, however, stops during package finalization without producing an `.app` while
retaining exit code 0. Node.js 24.18.0 is used because it reliably produces the artifact.

### Commands

Start the desktop app in development mode.

```sh
pnpm start
```

Run the project checks.

```sh
pnpm check
pnpm test
pnpm smoke:dev
pnpm make
pnpm smoke:packaged
```

- `pnpm check`: run type checking, linting, and formatting checks
- `pnpm test`: run the Vitest tests
- `pnpm smoke:dev`: verify startup, health, and authenticated shutdown in development
- `pnpm make`: create a macOS ZIP and inspect the packaged zatto content
- `pnpm smoke:packaged`: inspect the ASAR archive and verify the server in the generated app

### Desktop architecture

`@yuske-nakajima/zatto@0.1.3` is pinned as a production dependency.
At startup, Electron displays a preparation screen and starts the zatto server as a utility
process using the entry exported by `@yuske-nakajima/zatto/server`.
The server uses an operating-system-assigned port and an app-specific instance ID.
The app compares the runtime record with the health response before loading the zatto UI.
Startup and runtime failures display the bundled error screen.

Runtime and session state are isolated in a `zatto` directory under Electron user data.
`server.json` and its lock identify the owned server process, while `session.json` persists the
file session. The app does not use the CLI's default runtime or session.

Shutdown sends an instance-authenticated `POST /api/shutdown` request and verifies the HTTP 202
response, utility-process exit code, and release of the runtime record and lock.
SIGTERM is used only as a fallback for a utility process still owned by the app.
Runtime-record PIDs and external processes are never terminated.

Development and packaged smoke probes use the same server manager. They verify:

- the port assigned for port 0 in the runtime record
- the name, version, instance ID, and protocol version from `/api/health`
- release of the runtime record and lock after shutdown

The packaged app contains the zatto server and its production dependency closure as one ESM
bundle at the public `@yuske-nakajima/zatto/server` export target.
It also preserves the package exports and the complete static UI from `dist/web`.

### Security model

Node.js APIs are unavailable to the renderer.
The main window enables context isolation, sandboxing, and web security.
The preload does not expose an API to web content.

For file-manager drops, the preload converts operating-system `File` objects to absolute paths and
sends them through restricted IPC. The main process validates the sender, main frame, owned
origin, and payload. Absolute paths and path lookup APIs are not exposed to web content.

Navigation is restricted to the validated zatto server origin.
Different hosts and ports, credential-bearing URLs, external URLs, new windows, and permission
requests are rejected.

Untrusted HTML under zatto's `/f/` route is isolated in a subframe by a CSP added to Electron
responses. Local scripts, styles, images, audio, and video remain available within the HTML
directory, including data and blob URLs. API access, external-origin communication, form
submission, same-origin privileges, parent-page access, and zatto API access are denied.

### Branding

The app icon uses overlapping HTML cards that form the shape of a Z.
The repository contains a transparent 1024-pixel master and platform formats:

- `apps/desktop/assets/brand/zatto-desktop-master.png`: source image
- `apps/desktop/assets/icons/zatto-desktop.icns`: macOS
- `apps/desktop/assets/icons/zatto-desktop.ico`: Windows
- `apps/desktop/assets/icons/zatto-desktop.png`: Linux

Regenerate the platform assets when ImageMagick is available.

```sh
pnpm icons:generate
```

### Version and macOS release

The desktop app version is `0.1.7`.
`apps/desktop/package.json` is the source of truth.

Run the GitHub Actions `Release` workflow manually from `main`.
The workflow reads the package version, runs the quality and smoke checks, signs and notarizes
the macOS app, creates a `v<version>` tag and GitHub Release, and attaches the ZIP.
An existing tag prevents duplicate publication.

Configure these repository Actions Secrets before releasing:

- `MACOS_CERTIFICATE_P12`: Base64-encoded Developer ID Application P12
- `MACOS_CERTIFICATE_PASSWORD`: P12 export password
- `MACOS_SIGNING_IDENTITY`: `Developer ID Application: Name (TEAMID)` identity
- `APPLE_ID`: Apple Developer Program Apple ID
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific notarization password
- `APPLE_TEAM_ID`: Apple Developer Program team ID

The workflow imports the certificate into a temporary keychain and removes the keychain and
P12 file when it finishes. Certificates and Apple credentials are not stored in the repository.

Verify an installed release with codesign and Gatekeeper.

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/zatto.app"
spctl --assess --type execute --verbose=2 "/Applications/zatto.app"
```
