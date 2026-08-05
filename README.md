# Zatto Desktop

Zatto Desktopは、zattoをmacOSで利用するためのElectronアプリです。
このリポジトリには、Electronシェルと静的な準備画面を実装しています。

## 必要な環境

- macOS
- [mise](https://mise.jdx.dev/)

Node.js 24.18.0とpnpm 11.17.0は`.mise.toml`で固定しています。

```sh
mise install
pnpm install --frozen-lockfile
```

静的解析にはTypeScript 7.0.2とBiome 2.5.5を使用します。
Electron Forgeの依存関係にはGit経由のパッケージが含まれるため、`pnpm-workspace.yaml`で`blockExoticSubdeps`を無効にしています。
Forgeが依存関係を収集できるように、pnpmの依存レイアウトはhoistedへ固定しています。
minimum release ageの除外対象は、固定バージョンを導入直後から再現できるように、必要なパッケージとそのメタデータだけを列挙しています。

Node.js 26.6.0でも型検査、単体テスト、開発スモークテストは成功しました。
一方、Electron Forgeは終了コード0のままパッケージのfinalizeで停止し、`.app`を生成しませんでした。
成果物を確実に生成できるNode.js 24.18.0を採用しています。

## 開発コマンド

```sh
pnpm start
```

準備画面を表示し、アプリ専用のzattoサーバーを起動します。

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
- `pnpm smoke:packaged`: ASAR構成の検査後、生成済み`.app`で開発ビルドと同じサーバー検証を実行

## zattoサーバーの検証結果

`@yuske-nakajima/zatto@0.1.3`をproduction dependencyとして固定しています。
通常起動では、最初に準備画面を作成します。
その後、Electronのutility processとしてzattoサーバーを起動します。
起動entryは`@yuske-nakajima/zatto/server`のexport先です。
起動時はport 0とアプリ専用instance IDを指定します。
runtime recordとhealth identityを照合し、起動したサーバーを検証します。
準備画面からzatto UIへの遷移は実装していません。

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

パッケージには、zattoサーバーとproduction dependency closureを単一のESMバンドルとして配置します。
配置先は`@yuske-nakajima/zatto/server`のexport先です。
package metadataには同じexportsを含めるため、開発版とパッケージ版は同じ公開specifierを解決します。
zattoの静的UIは`dist/web`全体を同じパッケージ相対位置へ配置します。
`pnpm make`と`pnpm smoke:packaged`は、server export、package metadata、静的UIを検査します。

## バージョン管理

アプリのバージョンは`0.1.3`です。
バージョンは`package.json`を正として管理します。
配布物の署名、公証、公開手順は、この開発基盤に含みません。

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離、サンドボックス、Webセキュリティを有効にします。
preloadからレンダラーへ公開するAPIはありません。
