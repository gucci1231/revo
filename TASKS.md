# 📋 Project Tasks (Visitor Host Revolution 2.0)

## 📌 今後の開発タスク & メモ (Upcoming Tasks)

### 1. GAS による PUSH 型リアルタイム同期設定
- **概要**: Google フォーム送信時・スプレッドシート更新時のイベントから `https://revo.k-d-o.biz/api/sync.php` をWebフック呼び出し（PUSH型）して SQLite DB に即時同期する。
- **状況**: GAS スクリプト作成済。スプレッドシート側へのトリガー設置手順案内済。

### 2. Web画面からのメールテンプレート管理 ＆ GAS経由メール送信機能
- **概要**:
  - Web画面（`index.html` / 管理画面）上でメールテンプレート（件名・本文、`{name}` や `{event_date}` 等の差し込み変数）の作成・保存・編集機能を構築。
  - メール送信実行時、PHPからGASエンドポイント（`GmailApp.sendEmail`）を呼び出し、Gmailから迷惑メール判定を回避しつつ送信履歴を残して安全にメール送信する仕組みを実装。
- **状況**: 設計考案完了。次回以降の優先タスク。
