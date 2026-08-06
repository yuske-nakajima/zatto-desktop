# Zatto Desktop

<p align="center">
  <img src="assets/icons/zatto-desktop.png" alt="Zatto Desktopのアプリアイコン" width="160" height="160" />
</p>

[English](./README.md)

Zatto Desktopは、zattoをmacOSで利用するためのElectronアプリです。
このリポジトリには、Electronシェルと静的な準備画面を実装しています。

## ブランディング

重なったHTMLカードがZの形に見えるアイコンを採用しています。
1024pxの原画とmacOS、Windows、Linux向けの形式を管理しています。

- `assets/brand/zatto-desktop-master.png`: 1024pxの透過原画
- `assets/icons/zatto-desktop.icns`: macOS向けアイコン
- `assets/icons/zatto-desktop.ico`: Windows向けアイコン
- `assets/icons/zatto-desktop.png`: Linux向け512pxアイコン

ImageMagickを利用できる環境では、原画から各形式を再生成できます。

```sh
pnpm icons:generate
```

## 必要な環境

- macOS
- [mise](https://mise.jdx.dev/)

Node.js 24.18.0とpnpm 11.17.0は`.mise.toml`で固定しています。

```sh
mise install
pnpm install --frozen-lockfile
```

静的解析にはTypeScript 7.0.2とBiome 2.5.5を使用します。
Electron Forgeの依存関係にはGit経由のパッケージが含まれます。
そのため、`pnpm-workspace.yaml`で`blockExoticSubdeps`を無効にしています。
Forgeが依存関係を収集できるようにしています。
pnpmの依存レイアウトはhoistedへ固定しています。
minimum release ageの除外対象は、必要なパッケージとメタデータだけです。
固定バージョンを導入直後から再現できます。

Node.js 26.6.0でも型検査と単体テストは成功しました。
開発スモークテストも成功しました。
一方、Electron Forgeは終了コード0のまま停止しました。
停止した場所はパッケージのfinalizeです。
`.app`は生成されませんでした。
成果物を確実に生成できるNode.js 24.18.0を採用しています。

## 開発コマンド

```sh
pnpm start
```

準備画面を表示し、検証済みのアプリ専用zatto UIへ遷移します。

## HTMLファイルの追加

「ファイル > HTMLファイルを開く」または`Command+O`で、
HTMLファイルを追加できます。
ファイル選択ダイアログでは、`.html`と`.htm`を複数選択できます。
Finderからzattoのウィンドウへ、
複数のHTMLファイルをドロップすることもできます。
ファイルをウィンドウへ移動すると、全画面のドロップシールドを表示します。
ドロップシールドはHTMLプレビューより手前に表示されます。
そのため、ファイルをウィンドウ全体へドロップできます。
視差効果を減らす設定では、ドロップ時の動きを抑えます。
1回に追加できるファイルは256件までです。
上限を超えた場合は、ファイルを追加せずにエラーを表示します。
追加された先頭のファイルを表示します。
一覧はzattoのWebSocket更新を反映します。
重複しているファイルと存在しないファイルは追加されません。
シンボリックリンクは実体パスへ解決し、同じ実体は1件として扱います。
ディレクトリや通常ファイルではない項目も追加されません。
この場合は、既存セッションを維持します。
ダイアログのキャンセル、追加処理の失敗、サーバー停止は、
個別の結果として処理します。

```sh
pnpm check
pnpm test
pnpm smoke:dev
pnpm make
pnpm smoke:packaged
```

- `pnpm check`: 型検査、Lint、書式検査
- `pnpm test`: Vitestによる単体テスト
- `pnpm smoke:dev`: 開発ビルドで起動、health、認証付きshutdownを検証
- `pnpm make`: macOS向けZIPパッケージを作成し、ASAR内のzatto構成を検査
- `pnpm smoke:packaged`: ASAR構成と生成済み`.app`のサーバー検証

## zattoサーバーの検証結果

`@yuske-nakajima/zatto@0.1.3`をproduction dependencyとして固定しています。
通常起動では、最初に準備画面を作成します。
その後、Electronのutility processとしてzattoサーバーを起動します。
起動entryは`@yuske-nakajima/zatto/server`のexport先です。
起動時はport 0とアプリ専用instance IDを指定します。
runtime recordとhealth identityを照合し、起動したサーバーを検証します。
サーバーの検証が完了するまで、zatto UIのURLは読み込みません。
サーバーの起動時に問題が起きた場合は、エラー画面を表示します。
稼働中に問題が起きた場合も同じ画面を表示します。

サーバーのstateは、Electronのuser dataディレクトリに保存します。
保存先には`zatto`サブディレクトリを使います。
`server.json`と対応するlockは、実行中の所有確認に使います。
`session.json`は、アプリを再起動しても維持します。
CLIの既定runtimeとsessionにはアクセスしません。

アプリ終了時は、instance ID付きの`POST /api/shutdown`を送ります。
レスポンスがHTTP 202であることを確認します。
utility processの終了コードが0であることも確認します。
さらにruntime recordとlockの消失を確認してからアプリを終了します。
正常停止ではutility processへSIGTERMを送りません。
shutdownに失敗した場合は、保持中のutility processの状態を確認します。
生存している場合だけ、そのutility processへSIGTERMを送ります。
runtime recordのPIDや外部プロセスは停止しません。

開発版とパッケージ版のsmoke probeは、同じmanagerを使います。
smoke probeでは次の項目を確認できます。

- port 0で割り当てられたポートをruntime recordから取得
- `/api/health`の名前、バージョン、インスタンスID、プロトコル版
- shutdown後のruntime recordとlock directoryの解放

probeのruntimeとsessionは、user data配下の一時ディレクトリへ隔離します。
所有するutility processの正常終了を確認します。
正常終了を確認した後だけ、一時ディレクトリを削除します。

パッケージには、zattoサーバーとproduction dependency closureを配置します。
これらは単一のESMバンドルです。
配置先は`@yuske-nakajima/zatto/server`のexport先です。
package metadataには同じexportsを含めます。
開発版とパッケージ版は同じ公開specifierを解決します。
zattoの静的UIは`dist/web`全体を同じパッケージ相対位置へ配置します。
`pnpm make`と`pnpm smoke:packaged`は、server exportを検査します。
package metadataと静的UIも検査します。

## バージョン管理

アプリのバージョンは`0.1.5`です。
バージョンは`package.json`を正として管理します。

## macOS向けRelease

GitHub Actionsの`Release` workflowを`main`から手動実行します。
workflowは`package.json`のバージョンを読み取ります。
`v<version>`形式のタグとGitHub Releaseを作成し、ZIPを添付します。
同じタグが存在する場合は、Releaseを作成しません。

Release前に型検査、Lint、書式検査、テストを実行します。
開発版とパッケージ版のzattoサーバーも検証します。
配布用アプリはDeveloper ID Application証明書で署名します。
Electron ForgeがAppleのnotarytoolで公証し、結果をアプリへstapleします。
最後にcodesignとGatekeeperで配布用アプリを検証します。

リポジトリのActions Secretsに次の値を登録してください。

- `MACOS_CERTIFICATE_P12`: Developer ID Application証明書と秘密鍵を含むP12ファイルのBase64文字列
- `MACOS_CERTIFICATE_PASSWORD`: P12ファイルの書き出しパスワード
- `MACOS_SIGNING_IDENTITY`: `Developer ID Application: 名前 (TEAMID)`形式の署名ID
- `APPLE_ID`: Apple Developer Programへ登録したApple ID
- `APPLE_APP_SPECIFIC_PASSWORD`: 公証用のアプリ用パスワード
- `APPLE_TEAM_ID`: Apple Developer ProgramのTeam ID

証明書とApple認証情報は、リポジトリへ保存しません。
workflowは証明書を一時キーチェーンへ読み込みます。
完了時には、一時キーチェーンとP12ファイルを削除します。

### インストールと起動の確認

1. GitHub ReleasesからZIPをダウンロードします。
2. ZIPを展開し、`Zatto Desktop.app`を`Applications`へ移動します。
3. Finderから`Zatto Desktop.app`を開きます。
4. 準備画面の後にzatto UIが表示されることを確認します。
5. `Command+O`でHTMLファイルを追加できることを確認します。
6. アプリを終了し、次回起動でもセッションが維持されることを確認します。

Gatekeeperが配布物を受け入れるかコマンドでも確認できます。

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/Zatto Desktop.app"
spctl --assess --type execute --verbose=2 "/Applications/Zatto Desktop.app"
```

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離を有効にします。
サンドボックスも有効にします。
Webセキュリティも有効にします。
preloadからレンダラーへ公開するAPIはありません。
Finderのドロップは、preload内でOS由来のFileを絶対パスへ変換します。
絶対パスは、送信元、main frame、所有origin、payloadを検証する
限定IPCへ直接送ります。
Webコンテンツへパス取得APIや絶対パスを公開しません。
レンダラーが移動できるURLを限定します。
移動先は検証済みzattoサーバーと同じoriginです。
別host、別port、認証情報付きURL、外部URL、新規ウィンドウを拒否します。
権限要求と権限確認は、すべて拒否します。
所有originのsubFrame文書は、Electronが応答へ追加するCSPで隔離します。
この境界には、zattoの`/f/`内にある未信頼HTMLも含まれます。
このCSPは、インラインとdata URLおよびblob URLのスクリプトを許可します。
画像、音声、動画はHTMLと同じディレクトリだけを許可します。
スクリプトとスタイルも同じディレクトリだけを許可します。
data URLとblob URLによるローカル資産も許可します。
API通信と外部originへの通信は拒否します。
フォーム送信も拒否します。
未信頼HTMLには同一origin権限がありません。
親画面やzatto APIへアクセスできません。

## ウィンドウ状態

通常時の位置と大きさをuser data配下へ保存します。
最大化とフルスクリーンの状態も保存します。
保存値が壊れている場合は初期値を使います。
保存位置が全ディスプレイの外にある場合は補正します。
ウィンドウは利用可能な画面へ戻ります。
状態の保存に失敗しても、所有するzattoサーバーを停止します。
