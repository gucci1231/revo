# 🧠 Project Memory (Visitor Host Revolution 2.0)

## 🏛 アーキテクチャ & システム設計メモ

### 1. データベース構造 & データフロー
- **主データベース**: Xserver 上の SQLite (`api/data/database.sqlite`)
  - WALモード有効（高並行・超高速レスポンス <10ms）。
  - 主要テーブル: `visitors`, `visitors_status`, `hearing_sheets`, `members`, `settings`, `action_plans`, `email_templates`
  - **自動日次バックアップ & 7日間ローテーション**:
    - スクリプト: `api/scripts/backup_db.php`（毎日 04:00 cron実行）
    - 保存先: `api/data/backups/database_YYYY-MM-DD_His.sqlite`（7日経過分は自動削除）
    - 復元ツール: `api/scripts/restore_db.php`（CLI対話式/引数指定でワンコマンド安全復元）
- **Google スプレッドシート**: フォーム入力受付・GASエクスポート専用。

### 2. データ同期方式
- **方式**: PUSH型 Webhook（スプレッドシート GAS ➔ `https://revo.k-d-o.biz/api/sync.php`）
- **同期範囲**: ビジター一覧、ステータス、ヒアリングシート、メンバー一覧
- **Web ➔ GAS 同期**: ステータス更新・メールテンプレート更新（`GasWebhookService`）

### 3. メール送信 & テンプレート管理
- **送信エンジン**:
  - 個別フォローメール等: GAS（`GmailApp.sendEmail`）
  - 定期レポート & 即時アクション速報（Report Manager）: Xserver PHP `mail()` / `MailService`（送信元: `info@k-d-o.biz`）
- **定期レポート自動配信 (Cron)**:
  - スクリプト: `api/scripts/send_scheduled_reports.php`（Xserver Cron `*/10 * * * *` 実行）
  - 送信履歴: `api/data/report_sent_log.json` による日次重複送信防止
  - テンプレート管理: `report_templates`（6種類の定期・即時通知、StripeスタイルHTMLメール）
- **即時自動送信トリガー**:
  - `ActionPlanController` (アクション完了・報告時): `action_completed` テンプレートで自動送信
  - `SyncService` (Google Forms 新規ビジター同期時): `new_visitor_applied` テンプレートで自動送信
- **テンプレート管理**: Web画面（「メールテンプレート」および「報告・メッセージ管理」）から一覧 ➔ 編集 ➔ バリデーション ➔ リアルタイムプレビュー ➔ 保存・テスト送信が可能。
- **SQLiteテーブル**: `email_templates`（9種類）, `report_templates`（6種類）

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

---

## 🎨 全体デザイン思想 & UIシステム規約 (Design Philosophy & System)

### 1. 基本哲学 (Apple-Inspired Radical Minimalism & Functional Purity)
- **説明的テキストの徹底排除 (No Verbal Redundancy)**:
  - 「〜の一覧」「〜はこちら」「達成率」「目標：〜名」などの冗長な説明文言を画面から徹底的に排除。
  - タイポグラフィのサイズ対比、数字のスケール、幾何学的シェイプ（リングゲージやバー）、コンテキスト配置だけで、ユーザーが0.1秒で直感できるUIを追求する。
- **アイコンの過剰装飾禁止 (Icon Minimalism)**:
  - アイコンのための色付き正方形ボックスや、テキストに付随する不要な装飾アイコンを乱用しない。
  - 詳細画面の戻るボタン（`<i class="fa-solid fa-chevron-left"></i>`）をはじめとする操作ボタンは、Appleスタイルのミニマルなアイコン単体で維持し、説明文言を追加しない。

### 2. カラーシステム & セマンティクス (Color Semantics & Clean Slate)
- **純白ベース (Pure White & Clean Slate)**:
  - カードやコンテナは純白（`#ffffff`）を基本とし、極薄の繊細な境界線（`#e2e8f0`）で区切る。
  - 画面全体を重くする過剰なベタ塗り・強いグラデーション背景・派手なオーラは行わない。
- **カラーセマンティクス (正常＝青 🔵 / 警告＝赤 🔴)**:
  - **正常・進行中・メインアクション**: 澄んだエレクトリックブルー（`#0071e3` / `#2563eb`）で統一。知性的で信頼感のある佇まいを形成。
  - **警告・異常・未達・超過**: クリムゾンレッド（`#ef4444` / `#dc2626`）。カード全体を着色するのではなく、右上のスマートなステータスドット（`kpi-status-dot`）やバッジとしてピンポイントで点灯させ、品格を保ちながら注意を喚起する。
- **温度感・感触ランクのカラー統一 (Feel Rank A / B / C)**:
  - **ランク A (好印象・即入会・最優先)**: **エメラルドグリーン 🟢** (`#059669`, `#10b981`, `#ecfdf5`)
  - **ランク B (検討中・ハードル・フォロー要)**: **イエロー 🟡** (`#a16207`, `#eab308`, `#fefce8`)
  - **ランク C (時間要・見送り・低確度)**: **スレートグレー ⚪** (`#64748b`, `#f8fafc`, `#f1f5f9`)

### 3. タイポグラフィ階層 (Typography Hierarchy & Tabular Numerals)
- **数値・KPI表示**:
  - `Barlow Semi Condensed`, `DIN Alternate`, `DIN Condensed` による力強い縦長モダンタイポグラフィを採用。
  - 数字のズレを防ぐため、等幅数字（`font-variant-numeric: tabular-nums`）を徹底。
- **日本語テキスト**:
  - `-apple-system`, `BlinkMacSystemFont`, `Hiragino Sans` によるクリーンな可読性と洗練された字詰め（`letter-spacing`）。

### 4. マイクロインタラクション & モーション (Subtle, Natural Micro-interactions)
- **クリーンホバー**:
  - ホバー時にカードが濃色化・発光するような過剰な着色は行わず、ごく自然で軽やかな微動リフト（`translateY(-3px)`）と控えめなシャドウのみを適用。
- **動的アニメーション**:
  - ダッシュボード表示時の数値カウントアップ（`requestAnimationFrame` による cubic-bezier イージング）と、プログレスリングのスムーズな時計回り展開。
  - アクション完了時のセレブレーション・エフェクト（Quest Clear）等、達成感を演出するピンポイントなマイクロインタラクション。

### 5. KPIボード デザインスタイル規約 (Ultimate Minimal & Integrated Gauge)
- **一体型ウィジェット構造**:
  - `%` や余計な単位を排し、大型プログレスリング（`126px`）の中心に特大メイン数字（`56px`）を直接内包する構造を維持。
- **4大主要KPIカードの並び順**:
  1. **`08/27`** (次回定例会 - 日付のみの極小ラベル)
  2. **`要対応`** (未完了アクション件数)
  3. **`申込ビジター`** (期累計申込ビジター総数)
  4. **`入会目標`** (期累計入会数 / 目標値)
