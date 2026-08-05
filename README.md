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

準備画面を表示するElectronアプリを起動します。

```sh
pnpm check
pnpm test
pnpm smoke:dev
pnpm make
pnpm smoke:packaged
```

- `pnpm check`: 型検査、Lint、書式検査
- `pnpm test`: Vitestによる単体テスト
- `pnpm smoke:dev`: 開発ビルドでzattoサーバーの起動、health、停止後のcleanupを検証
- `pnpm make`: macOS向けZIPパッケージを作成し、ASAR内のzatto構成を検査
- `pnpm smoke:packaged`: ASAR構成の検査後、生成済み`.app`で開発ビルドと同じサーバー検証を実行

## zattoサーバーの検証結果

`@yuske-nakajima/zatto@0.1.3`をproduction dependencyとして固定しています。
開発ビルドでは、Electronのutility processから`@yuske-nakajima/zatto/server`のexport先をforkし、次の項目を確認できます。

- port 0で割り当てられたポートをruntime recordから取得
- `/api/health`の名前、バージョン、インスタンスID、プロトコル版
- SIGTERM後のruntime recordとlock directoryの解放

パッケージには、zattoサーバーとproduction dependency closureを単一のESMバンドルとして配置します。
配置先は`@yuske-nakajima/zatto/server`のexport先です。
package metadataには同じexportsを含めるため、開発版とパッケージ版は同じ公開specifierを解決します。
zattoの静的UIは`dist/web`全体を同じパッケージ相対位置へ配置します。
`pnpm make`と`pnpm smoke:packaged`は、server export、package metadata、静的UIを検査します。

## バージョン管理

アプリのバージョンは`0.1.2`です。
バージョンは`package.json`を正として管理します。
配布物の署名、公証、公開手順は、この開発基盤に含みません。

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離、サンドボックス、Webセキュリティを有効にします。
preloadからレンダラーへ公開するAPIはありません。
