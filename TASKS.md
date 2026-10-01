# 📋 Project Tasks (Visitor Host Revolution 2.0)

## 📌 今後の開発タスク & メモ (Upcoming Tasks)

### 1. GAS による PUSH 型リアルタイム同期設定
- **概要**: Google フォーム送信時・スプレッドシート更新時のイベントから `https://revo.k-d-o.biz/api/sync.php` をWebフック呼び出し（PUSH型）して SQLite DB に即時同期する。
- **状況**: GAS スクリプト作成済。スプレッドシート側へのトリガー設置手順案内済。

### 4. 🚀 REvoチャプター総合管理システム（REvo OS）大規模バージョンアップ
- **計画書**: [chapter_evolution_plan.md](file:///Users/kawaguchiyouhei/.gemini/antigravity-ide/brain/6bdffc92-3685-4689-ad28-87f65c00638a/chapter_evolution_plan.md)
- **フェーズ構成**:
  - **Phase 1 [完了]**: ナビゲーション刷新（階層型・新カテゴリ）＆公式リンク集モジュール新設（`chapter_links`テーブル・CRUD・純白カードUI・本番稼働）
  - **Phase 2 [完了]**:
    - **Step 2-1 [完了]**: BNI Connect PALMS 自動クローラー・同期スクリプト（認証API・Spring Security JWT Webセッション・チャプターサマリーPALMS取得・SQLite `palms_reports` 保存・Xserver Cron用 `api/scripts/fetch_bni_connect_palms.php` & ローカル用 `scripts/fetch_bni_connect_palms.js` 実装・テスト110件全パス）
    - **Step 2-2 [完了]**: 月間・期別 PALMSランキング画面UI実装
      - Appleスタイル表彰台メダルTop 3、総合スコア・リファーラル・1to1・ビジター・売上貢献・出欠PALMSランキング切替
      - **柔軟な期間選択**: ワンタッププリセット（直近4週間、直近第2期、第1期後半、第1期前半、過去2年通算）＋ 任意日付カレンダー指定
      - **PPW & RPW 実装**: スライド仕様準拠（$W=P+A+L+M+S$、$\text{RPW}=(RGI+RGO)/W$、$\text{PPW}=(RGI+RGO+V+T)/W$、2.0/1.0基準バンド、平均値KPI、比較チャート）
      - **パームス個人詳細モーダル**: 個人名（ポディウム・テーブル・PPW/RPWチャートバー）クリックで開くパームス詳細（100点基準7大採点項目プログレスバー、PALMS原票内訳、期別ヒストリー推移比較）
      - **週別入力状況・スリップ活動推移**: 個人詳細モーダル内に直近の定例会ごとの出席判定（P/S/L/A/M）、スリップ入力状況（高貢献/入力済/スリップなし）、週貢献PPW、リファーラル、ビジター、1to1、TYFCB売上、CEUの推移を一覧表示
      - テスト120件全パス・Xserver本番稼働済
  - **Phase 3 [完了]**: トレーニング情報自動取得（京都シティセントラル カレンダー週次クローラー、研修一覧画面）
    - **自動クローラー & 同期エンジン**:
      - BNI 京都シティセントラル公式カレンダー（Region ID: 7641, `https://bni-ck.com/ja/events`）の JSON API（`/web/open/cmsViewEventTypesJson` & `/web/open/cmsViewEventsCalendarJson`）および詳細エンドポイント（`/bnicms/v3/frontend/eventdetail/display`）と連携。
      - 週次自動取得 Cron スクリプト `api/scripts/fetch_region_events.php` & ローカル用 `scripts/fetch_region_events.js` 実装。
      - SQLite `region_events` テーブルにイベントID、カテゴリ、開始・終了日時、オンライン/対面判定、会場住所、Googleマップリンク、担当トレーナー名・電話番号、受講料、定員・登録数、詳細HTML、参加申込URL等を自動Upsert。
    - **トレーニング・研修日程画面UI**:
      - Appleスタイル極上ミニマリズム・純白ベースカードUI。
      - 4大KPIカード（次回開催カウントダウン、今月の研修数、オンライン開催数、対面・集合研修数、等幅数字 `tabular-nums`）。
      - 多彩なスマートフィルタ（開催形式切替ピル: すべて / オンライン / 対面、動的月別タブ、カテゴリ選択、キーワード検索、開催予定 / 全期間 / 過去履歴切替）。
      - ワンクリック即時手動同期ボタン（ローディングアニメーション & 完了セレブレーション・エフェクト付き）。
      - 詳細モーダル（会場地図、定員状況、持ち物・注意事項、キャンセル規定、BNI Connect公式申込ダイレクトリンク）。
      - **イベントシェア機能 [完了]**:
        - 定例会詳細、チャプター予定、京都CC研修詳細、リスト表示カード、日別タイムラインからワンタップでイベント情報を共有可能。
        - **LINEで送る**: LINEアプリのトーク・グループへ美しく整形された案内文をワンタップ転送。
        - **Googleカレンダーに追加**: タイトル・日時・会場/Zoom・詳細・URLが事前入力された状態で直接Googleカレンダーに予定登録。
        - **案内文コピー & ネイティブ共有**: クリップボードへのワンタップコピー（トースト通知）および Web Share API によるスマホ共有シート連携。
        - **URLディープリンク**: `#training?event={id}` 形式のリンクから直接該当イベント詳細モーダルを自動オープン。
      - 単体テスト193件全パス・Xserver本番稼働済。
  - **Phase 4 [未着手]**: スケジュール＆調整さん出欠リマインダー（定期イベント登録、未回答者自動抽出、日次メール/LINE催促）



