# 🧠 Project Memory (Visitor Host Revolution 2.0)

## 🏛 アーキテクチャ & システム設計メモ

### 1. データベース構造 & データフロー
- **主データベース**: Xserver 上の SQLite (`api/data/database.sqlite`)
  - WALモード有効（高並行・超高速レスポンス <10ms）。
  - 主要テーブル: `visitors`, `visitors_status`, `hearing_sheets`, `members`, `settings`, `action_plans`, `email_templates`
- **Google スプレッドシート**: フォーム入力受付・GASエクスポート専用。

### 2. データ同期方式
- **方式**: PUSH型 Webhook（スプレッドシート GAS ➔ `https://revo.k-d-o.biz/api/sync.php`）
- **同期範囲**: ビジター一覧、ステータス、ヒアリングシート、メンバー一覧
- **Web ➔ GAS 同期**: ステータス更新・メールテンプレート更新（`GasWebhookService`）

### 3. メール送信 & テンプレート管理
- **送信エンジン**: GAS（`GmailApp.sendEmail`）
- **理由**: Xserver 直送りによる DMARC / SPF 迷惑メール判定リスク回避、および差出人 Gmail の「送信済みトレイ」に履歴を残すため。
- **テンプレート管理**: Web画面（「メールテンプレート」ページ）から一覧 ➔ 編集 ➔ バリデーション ➔ サンプル確認 ➔ OK（保存＆GASスプレッドシート `FollowMail_template` 同期）の5ステップで更新・管理。
- **SQLiteテーブル**: `email_templates`（9種類の標準テンプレート）

### 4. サーバー & 開発環境
- **ドメイン**: `https://revo.k-d-o.biz`
- **サーバー**: Xserver (`xs489303.xsrv.jp`, `/home/xs489303/k-d-o.biz/public_html/revo.k-d-o.biz`)
- **ローカル同期**: `scp` コマンドで本番 DB をローカルに取得可能。

### 5. 運用 & AIエージェント行動規約
- **ブラウザツールの起動完全禁止**:
  - `browser_subagent` などのブラウザ立ち上げはクレジットを急速に浪費するため、ユーザーからの明示的な指示がない限り**絶対に使用禁止**。
  - すべての調査・修正・検証はソースコード（AST/正規表現/静的解析）およびローカル単体テスト（`npm test`）で完結させること。
- **戻るボタン等のアイコンボタンに説明テキストを追加しない**:
  - 詳細画面の戻るボタン（`.vd-back-btn`）等に「一覧に戻る」などの文字を追加せず、アイコン単体で洗練されたデザインを維持すること。
