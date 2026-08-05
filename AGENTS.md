# 開発ガイド

## 対象

このリポジトリは、zattoをmacOSで利用するElectronアプリを管理します。
独自レンダラーの責務は、準備画面と起動失敗時のエラー表示です。

## 必須コマンド

変更後は次のコマンドを実行してください。

```sh
pnpm check
pnpm test
pnpm make
```

## 実装ルール

- TypeScriptのstrict modeを維持する
- 公開シンボルへAPI仕様を示すJSDocを付ける
- ウィンドウ設定を変更するときは、単体テストを先に更新する
- `nodeIntegration: false`を維持する
- `contextIsolation: true`を維持する
- `sandbox: true`を維持する
- `webSecurity: true`を維持する
- preloadから公開するAPIを必要な機能に限定する
- 認証情報や秘密情報をソースへ記録しない

## 変更範囲

サーバー管理、画面遷移、署名、公証、配布は別の機能として扱います。
