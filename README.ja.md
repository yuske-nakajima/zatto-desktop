# zatto

<p align="center">
  <img src="apps/desktop/assets/icons/zatto-desktop.png" alt="zattoのアプリアイコン" width="160" height="160" />
</p>

[English](./README.md)

`zatto`は、複数のHTMLファイルを1つのセッションにまとめるローカルビューアーです。
このリポジトリでは、`zatto`のデスクトップアプリを開発しています。
コマンドライン版は
[`yuske-nakajima/zatto`](https://github.com/yuske-nakajima/zatto)で公開しています。
どちらも名称は`zatto`です。desktopは、この版の配布形態と利用方法を表します。

## 対応OS

- macOS: GitHub Releasesから利用可能
- Windows: 対応予定
- Linux: 対応予定

## インストール

[GitHub Releases](https://github.com/yuske-nakajima/zatto-desktop/releases)から
最新のmacOS向けZIPをダウンロードします。
ZIPを展開し、アプリを`Applications`へ移動してください。

Finderからアプリを開きます。
短い準備画面の後に、`zatto`のビューアーが表示されます。

## HTMLファイルの追加

`.html`または`.htm`ファイルは、次の方法で追加できます。

- 「ファイル > HTMLファイルを開く」を選択
- macOSでは<kbd>Command</kbd>+<kbd>O</kbd>、
  WindowsとLinuxでは<kbd>Ctrl</kbd>+<kbd>O</kbd>を押す
- ファイルマネージャーからファイルをドラッグし、ウィンドウ内の任意の場所へドロップ

追加した先頭のファイルをすぐに表示します。
表示するファイルは、`zatto`のファイルパネルから切り替えられます。
デスクトップアプリは元のファイル位置を専用ローカルサーバーへ渡すため、
相対パスで指定したアセットも表示できます。

1回の操作で最大256ファイルを追加できます。
重複ファイル、存在しないファイル、ディレクトリ、通常ファイルではない項目は追加しません。
同じファイルへ解決されるシンボリックリンクは、1ファイルとして扱います。
上限を超えた場合はファイルを追加せず、エラーを表示します。

## 次回起動時の復元

ファイルのセッション、ウィンドウの位置と大きさ、最大化、フルスクリーンの状態を
次回起動時に復元します。
保存した位置が利用可能なディスプレイの外にある場合は、自動的に補正します。

HTMLプレビューより手前に全画面のドロップ表示を出すため、
ウィンドウ全体へファイルをドロップできます。
OSで視差効果を減らす設定を有効にしている場合は、表示時の動きを抑えます。

## 開発

ここからは、デスクトップアプリの開発へ参加する人向けの情報です。

### リポジトリ構成

このリポジトリはpnpm workspaceで管理します。

- `apps/desktop`: Electronデスクトップアプリ
- `apps/site`: 製品サイトの実装時に追加するworkspace

共通のmise、pnpm、TypeScript、Biome、CI、Release設定はリポジトリルートで管理します。
記載しているコマンドはリポジトリルートから実行してください。

### 環境構築

現在の開発環境にはmacOSと[mise](https://mise.jdx.dev/)が必要です。
`.mise.toml`でNode.js 24.18.0とpnpm 11.17.0を固定しています。

```sh
mise install
pnpm install --frozen-lockfile
```

静的解析にはTypeScript 7.0.2とBiome 2.5.5を使用します。
Electron Forgeの依存関係には、Git経由でインストールするパッケージが含まれます。
Forgeが依存関係を収集できるように、`pnpm-workspace.yaml`で
`blockExoticSubdeps`を無効にしています。
pnpmの依存レイアウトはhoistedへ固定しています。
minimum release ageの除外対象は、必要なパッケージとメタデータだけです。

Node.js 26.6.0でも型検査、単体テスト、開発スモークテストは成功します。
一方、Electron Forgeは終了コード0のままパッケージのfinalizeで停止し、
`.app`を生成しません。成果物を確実に生成できるNode.js 24.18.0を使用しています。

### コマンド

デスクトップアプリを開発モードで起動します。

```sh
pnpm start
```

プロジェクトを検証します。

```sh
pnpm check
pnpm test
pnpm smoke:dev
pnpm make
pnpm smoke:packaged
```

- `pnpm check`: 型検査、Lint、書式検査
- `pnpm test`: Vitestによるテスト
- `pnpm smoke:dev`: 開発版の起動、health、認証付きshutdownを検証
- `pnpm make`: macOS向けZIPを作成し、パッケージ内のzatto構成を検査
- `pnpm smoke:packaged`: ASARと生成済みアプリのサーバーを検証

### デスクトップアプリの構成

`@yuske-nakajima/zatto@0.1.3`をproduction dependencyとして固定しています。
起動時はElectronの準備画面を表示し、
`@yuske-nakajima/zatto/server`が公開するentryから
zattoサーバーをutility processとして起動します。
サーバーにはOSが割り当てるポートとアプリ専用instance IDを使います。
runtime recordとhealth responseを照合した後で、zatto UIを読み込みます。
起動時または稼働中に問題が起きた場合は、組み込みのエラー画面を表示します。

runtimeとsessionは、Electronのuser data配下にある`zatto`ディレクトリへ隔離します。
`server.json`と対応するlockで、所有するサーバープロセスを識別します。
`session.json`にはファイルセッションを保存します。
CLIの既定runtimeとsessionは使用しません。

終了時はinstance ID付きの`POST /api/shutdown`を送り、HTTP 202、
utility processの終了コード、runtime recordとlockの解放を確認します。
SIGTERMは、アプリが所有するutility processが残っている場合だけ使用します。
runtime recordのPIDや外部プロセスは停止しません。

開発版とパッケージ版のsmoke probeは、同じserver managerで次の項目を検証します。

- port 0へ割り当てられたポートをruntime recordから取得
- `/api/health`の名前、バージョン、インスタンスID、プロトコル版
- shutdown後のruntime recordとlockの解放

パッケージには、zattoサーバーとproduction dependency closureを
1つのESMバンドルとして配置します。
配置先は`@yuske-nakajima/zatto/server`の公開export先です。
package exportsと`dist/web`の静的UI全体も維持します。

### セキュリティ

レンダラーではNode.js APIを利用できません。
メインウィンドウはコンテキスト分離、サンドボックス、Webセキュリティを有効にします。
preloadからWebコンテンツへAPIを公開しません。

ファイルマネージャーからのドロップでは、preloadがOS由来の`File`を絶対パスへ変換し、
限定IPCへ送ります。main processは送信元、main frame、所有origin、payloadを検証します。
絶対パスとパス取得APIはWebコンテンツへ公開しません。

移動先は検証済みzattoサーバーのoriginに限定します。
異なるhostとport、認証情報付きURL、外部URL、新規ウィンドウ、権限要求を拒否します。

zattoの`/f/`配下にある未信頼HTMLは、Electronがresponseへ追加するCSPにより
subframe内へ隔離します。HTMLと同じディレクトリにあるスクリプト、スタイル、画像、
音声、動画は利用できます。data URLとblob URLのローカルアセットにも対応します。
API、外部origin、フォーム送信、同一origin権限、親画面、zatto APIへのアクセスは拒否します。

### ブランディング

重なったHTMLカードがZの形に見えるアイコンを採用しています。
1024pxの透過原画と、各プラットフォーム向けの形式を管理しています。

- `apps/desktop/assets/brand/zatto-desktop-master.png`: 原画
- `apps/desktop/assets/icons/zatto-desktop.icns`: macOS
- `apps/desktop/assets/icons/zatto-desktop.ico`: Windows
- `apps/desktop/assets/icons/zatto-desktop.png`: Linux

ImageMagickを利用できる環境では、各形式を再生成できます。

```sh
pnpm icons:generate
```

### バージョンとmacOS向けRelease

デスクトップアプリのバージョンは`0.1.7`です。
`apps/desktop/package.json`を正として管理します。

GitHub Actionsの`Release` workflowを`main`から手動実行します。
workflowはpackage versionを読み取り、品質検査とsmoke testを実行します。
その後、macOSアプリを署名、公証し、`v<version>`タグとGitHub Releaseを作成して
ZIPを添付します。同じタグが存在する場合は公開しません。

Release前に、リポジトリのActions Secretsへ次の値を登録してください。

- `MACOS_CERTIFICATE_P12`: Developer ID Application証明書を含むP12のBase64文字列
- `MACOS_CERTIFICATE_PASSWORD`: P12の書き出しパスワード
- `MACOS_SIGNING_IDENTITY`: `Developer ID Application: 名前 (TEAMID)`形式の署名ID
- `APPLE_ID`: Apple Developer Programへ登録したApple ID
- `APPLE_APP_SPECIFIC_PASSWORD`: 公証用のアプリ用パスワード
- `APPLE_TEAM_ID`: Apple Developer ProgramのTeam ID

workflowは証明書を一時キーチェーンへ読み込み、完了時にキーチェーンとP12を削除します。
証明書とApple認証情報はリポジトリへ保存しません。

インストール済みの配布物は、codesignとGatekeeperで検証できます。

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/zatto.app"
spctl --assess --type execute --verbose=2 "/Applications/zatto.app"
```
