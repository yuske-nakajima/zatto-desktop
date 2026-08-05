# Zatto Desktop

Zatto Desktopは、zattoをmacOSで利用するためのElectronアプリです。
このリポジトリには、Electronシェルと静的な準備画面を実装しています。

## 必要な環境

- macOS
- Node.js 22.12.0以上
- pnpm 10.34.5

Corepackを使うと、`package.json`で指定したpnpmを利用できます。

```sh
corepack enable
pnpm install
```

Electron Forgeの依存関係にはGit経由のパッケージが含まれます。
`pnpm-workspace.yaml`では、この依存形態を許可するために`blockExoticSubdeps`を無効にしています。
Forgeがパッケージを収集できるように、`.npmrc`では依存関係をhoistedレイアウトへ固定しています。

## 開発コマンド

```sh
pnpm start
```

準備画面を表示するElectronアプリを起動します。

```sh
pnpm check
pnpm test
pnpm make
```

- `pnpm check`: 型検査、Lint、書式検査
- `pnpm test`: Vitestによる単体テスト
- `pnpm make`: macOS向けZIPパッケージの作成

## バージョン管理

アプリの初期バージョンは`0.1.0`です。
バージョンは`package.json`を正として管理します。
配布物の署名、公証、公開手順は、この開発基盤に含みません。

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離、サンドボックス、Webセキュリティを有効にします。
preloadからレンダラーへ公開するAPIはありません。
