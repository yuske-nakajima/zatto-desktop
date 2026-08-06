# Zatto Desktop

<p align="center">
  <img src="assets/icons/zatto-desktop.png" alt="Zatto Desktop application icon" width="160" height="160" />
</p>

[日本語](./README.ja.md)

Zatto Desktop is an Electron application for using zatto on macOS.
This repository contains the Electron shell and its static preparation screen.

## Branding

The application icon uses overlapping HTML cards that form the shape of a Z.
The repository contains a 1024-pixel master and formats for macOS, Windows, and Linux.

- `assets/brand/zatto-desktop-master.png`: transparent 1024-pixel master
- `assets/icons/zatto-desktop.icns`: macOS icon
- `assets/icons/zatto-desktop.ico`: Windows icon
- `assets/icons/zatto-desktop.png`: 512-pixel Linux icon

Regenerate the platform formats from the master when ImageMagick is available.

```sh
pnpm icons:generate
```

## Requirements

- macOS
- [mise](https://mise.jdx.dev/)

`.mise.toml` pins Node.js 24.18.0 and pnpm 11.17.0.

```sh
mise install
pnpm install --frozen-lockfile
```

Static analysis uses TypeScript 7.0.2 and Biome 2.5.5.
Electron Forge dependencies include packages installed through Git.
The `pnpm-workspace.yaml` file therefore disables `blockExoticSubdeps` so
Forge can collect its dependencies.
The pnpm dependency layout is pinned to hoisted.
Only the required packages and metadata are excluded from the minimum release age.
This allows pinned versions to be installed reproducibly as soon as they are available.

Type checking, unit tests, and the development smoke test also passed on Node.js 26.6.0.
Electron Forge, however, stopped during package finalization while retaining exit code 0,
and did not produce an `.app` bundle.
Node.js 24.18.0 is used because it reliably produces the application artifact.

## Development

```sh
pnpm start
```

The application displays the preparation screen, then navigates to its validated,
application-owned zatto UI.

## Adding HTML files

Use **File > Open HTML Files** or <kbd>Command</kbd>+<kbd>O</kbd> to add HTML files.
The file dialog accepts multiple `.html` and `.htm` files.
Multiple HTML files can also be dragged from Finder into the zatto window.

Moving files over the window displays a full-window drop shield above the HTML preview,
allowing files to be dropped anywhere in the window.
The transition is reduced when the operating system requests reduced motion.

A single request can add up to 256 files.
Requests exceeding the limit display an error without adding any files.
The first successfully added file is displayed, and the list follows zatto WebSocket updates.
Duplicate and missing files are not added.
Symbolic links are resolved to their real paths, and paths with the same target are treated
as one file. Directories and entries that are not regular files are also excluded while the
existing session is preserved.
Dialog cancellation, add failures, and server shutdown are handled as distinct results.

Run the project checks.

```sh
pnpm check
pnpm test
pnpm smoke:dev
pnpm make
pnpm smoke:packaged
```

- `pnpm check`: run type checking, linting, and formatting checks
- `pnpm test`: run the Vitest unit tests
- `pnpm smoke:dev`: verify startup, health, and authenticated shutdown in a development build
- `pnpm make`: create a macOS ZIP and inspect the zatto content inside the ASAR archive
- `pnpm smoke:packaged`: inspect the ASAR archive and verify the server in the generated `.app`

## zatto server verification

`@yuske-nakajima/zatto@0.1.3` is pinned as a production dependency.
During normal startup, the application creates the preparation window and then starts the
zatto server as an Electron utility process.
The entry point is the target exported by `@yuske-nakajima/zatto/server`.
Startup uses port 0 and an application-specific instance ID.
The runtime record and health identity are compared to verify the started server.
The zatto UI URL is not loaded until this verification succeeds.
The error screen appears if the server fails during startup or while running.

Server state is stored in a `zatto` subdirectory of Electron's user data directory.
`server.json` and its corresponding lock verify ownership of the running process.
`session.json` persists across application restarts.
The application does not access the CLI's default runtime or session.

On application shutdown, the shell sends `POST /api/shutdown` with the instance ID.
It verifies an HTTP 202 response, exit code 0 from the utility process, and removal of the
runtime record and lock before exiting.
A normal shutdown does not send SIGTERM to the utility process.
If shutdown fails, the shell checks the utility process it owns and sends SIGTERM only while
that process is still alive. It never stops a PID from the runtime record or an external process.

Development and packaged smoke probes use the same manager.
They verify the following behavior:

- read the port assigned for port 0 from the runtime record
- verify the name, version, instance ID, and protocol version returned by `/api/health`
- verify release of the runtime record and lock directory after shutdown

Probe runtime and session files are isolated in a temporary directory under user data.
The directory is removed only after the owned utility process exits successfully.

The packaged application includes the zatto server and its production dependency closure as
a single ESM bundle. It is placed at the target exported by
`@yuske-nakajima/zatto/server`, and the package metadata contains the same exports.
Development and packaged builds therefore resolve the same public specifier.
The complete zatto static UI from `dist/web` is placed at the same package-relative location.
`pnpm make` and `pnpm smoke:packaged` inspect the server export, package metadata,
and static UI.

## Versioning

The application version is `0.1.5`.
`package.json` is the source of truth for the version.

## macOS release

Run the GitHub Actions `Release` workflow manually from `main`.
The workflow reads the version from `package.json`, creates a `v<version>` tag and GitHub
Release, and attaches the ZIP artifact.
It does not create a Release when the tag already exists.

Before release, the workflow runs type checking, linting, formatting checks, and tests.
It also verifies the zatto server in development and packaged builds.
The distribution application is signed with a Developer ID Application certificate.
Electron Forge notarizes it with Apple's notarytool and staples the result to the application.
Finally, the workflow validates the distribution application with codesign and Gatekeeper.

Configure these repository Actions Secrets:

- `MACOS_CERTIFICATE_P12`: Base64-encoded P12 containing the Developer ID Application certificate and private key
- `MACOS_CERTIFICATE_PASSWORD`: password used to export the P12
- `MACOS_SIGNING_IDENTITY`: signing identity in `Developer ID Application: Name (TEAMID)` format
- `APPLE_ID`: Apple ID registered with the Apple Developer Program
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password used for notarization
- `APPLE_TEAM_ID`: Apple Developer Program team ID

Certificates and Apple credentials are not stored in the repository.
The workflow imports the certificate into a temporary keychain and removes the keychain and
P12 file when it finishes.

### Installation and launch verification

1. Download the ZIP from GitHub Releases.
2. Extract the ZIP and move `Zatto Desktop.app` into `Applications`.
3. Open `Zatto Desktop.app` from Finder.
4. Confirm that the zatto UI appears after the preparation screen.
5. Confirm that <kbd>Command</kbd>+<kbd>O</kbd> adds HTML files.
6. Quit the application and confirm that the session is preserved on the next launch.

Gatekeeper acceptance can also be checked from the command line.

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/Zatto Desktop.app"
spctl --assess --type execute --verbose=2 "/Applications/Zatto Desktop.app"
```

## Security boundary

Node.js APIs are unavailable to the renderer.
The main window enables context isolation, sandboxing, and web security.
The preload does not expose an API to the renderer.

For Finder drops, the preload converts operating-system `File` objects to absolute paths.
It sends those paths directly through restricted IPC that validates the sender, main frame,
owned origin, and payload. Path lookup APIs and absolute paths are not exposed to web content.

Renderer navigation is restricted to the same origin as the validated zatto server.
Different hosts and ports, URLs containing credentials, external URLs, and new windows are
rejected. Permission requests and checks are always denied.

Subframe documents from the owned origin are isolated by a CSP added by Electron responses.
This boundary includes untrusted HTML under zatto's `/f/` route.
The CSP allows inline scripts and scripts from data and blob URLs.
Images, audio, video, scripts, and styles are limited to the same directory as the HTML,
with local assets also allowed through data and blob URLs.
API communication, external-origin communication, and form submission are rejected.
Untrusted HTML has no same-origin privileges and cannot access the parent page or zatto API.

## Window state

The application stores the normal window position and size under user data.
It also stores maximized and full-screen state.
Invalid saved values fall back to defaults.
Positions outside every display are corrected so the window returns to an available screen.
The application still stops its owned zatto server if saving window state fails.
