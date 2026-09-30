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
      - テスト118件全パス・Xserver本番稼働済
  - **Phase 3 [未着手]**: トレーニング情報自動取得（京都シティセントラル カレンダー週次クローラー、研修一覧画面）
  - **Phase 4 [未着手]**: スケジュール＆調整さん出欠リマインダー（定期イベント登録、未回答者自動抽出、日次メール/LINE催促）



