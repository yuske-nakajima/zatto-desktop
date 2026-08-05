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

`@yuske-nakajima/zatto@0.1.2`をproduction dependencyとして固定しています。
開発ビルドでは、Electronのutility processから`dist/server/index.js`を直接forkし、次の項目を確認できます。

- port 0で割り当てられたポートをruntime recordから取得
- `/api/health`の名前、バージョン、インスタンスID、プロトコル版
- SIGTERM後のruntime recordとlock directoryの解放

パッケージには、zattoサーバーとproduction dependency closureを単一のESMバンドルとして、同じ`node_modules/@yuske-nakajima/zatto/dist/server/index.js`へ配置します。
zattoの静的UIは`dist/web`全体を同じパッケージ相対位置へ配置し、`pnpm make`と`pnpm smoke:packaged`の両方でserver entry、package metadata、静的UIを検査します。
パッケージ済みアプリでは、zatto 0.1.2の直接実行判定が空白を含むアプリパスを扱えず、runtime recordの待機がタイムアウトします。
`import.meta.url`では`Zatto%20Desktop`となる一方、`process.argv[1]`では`Zatto Desktop`となるためです。
起動APIの意味を変える互換処理はこのリポジトリに追加せず、zatto側で公開起動エントリーが提供された後に`pnpm smoke:packaged`を成功条件へ切り替えます。

## バージョン管理

アプリのバージョンは`0.1.1`です。
バージョンは`package.json`を正として管理します。
配布物の署名、公証、公開手順は、この開発基盤に含みません。

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離、サンドボックス、Webセキュリティを有効にします。
preloadからレンダラーへ公開するAPIはありません。
