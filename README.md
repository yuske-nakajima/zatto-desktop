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

アプリのバージョンは`0.1.4`です。
バージョンは`package.json`を正として管理します。
配布物の署名、公証、公開手順は、この開発基盤に含みません。

## セキュリティ境界

レンダラーではNode.js APIを利用できません。
メインウィンドウは、コンテキスト分離を有効にします。
サンドボックスも有効にします。
Webセキュリティも有効にします。
preloadからレンダラーへ公開するAPIはありません。
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
