<?php
namespace Api\Repositories;

use Api\Database;

class ReportTemplateRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
        $this->ensureTable();
    }

    private function ensureTable(): void {
        $sql = "CREATE TABLE IF NOT EXISTS report_templates (
            id VARCHAR(64) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            category VARCHAR(64) NOT NULL,
            schedule_type VARCHAR(32) DEFAULT 'weekly',
            schedule_day VARCHAR(32) DEFAULT 'Sun',
            schedule_time VARCHAR(32) DEFAULT '20:00',
            is_enabled INTEGER DEFAULT 1,
            email_subject VARCHAR(255) NOT NULL,
            email_html_body TEXT NOT NULL,
            line_template_body TEXT NOT NULL,
            default_recipients TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )";
        $this->db->query($sql);

        // カラム追加（既存テーブルがある場合）
        try {
            $cols = $this->db->fetchAll("PRAGMA table_info(report_templates)");
            $colNames = array_column($cols, 'name');
            if (!in_array('schedule_type', $colNames)) {
                $this->db->query("ALTER TABLE report_templates ADD COLUMN schedule_type VARCHAR(32) DEFAULT 'weekly'");
            }
            if (!in_array('schedule_day', $colNames)) {
                $this->db->query("ALTER TABLE report_templates ADD COLUMN schedule_day VARCHAR(32) DEFAULT 'Sun'");
            }
            if (!in_array('schedule_time', $colNames)) {
                $this->db->query("ALTER TABLE report_templates ADD COLUMN schedule_time VARCHAR(32) DEFAULT '20:00'");
            }
        } catch (\Exception $e) {}

        // 6大通知のシード
        $this->seedDefaults();
    }

    public function getDefaults(): array {
        return [
            'weekly_visitor_status' => [
                'id' => 'weekly_visitor_status',
                'title' => '今週のビジター申込状況 (毎週日曜)',
                'category' => 'weekly',
                'schedule_type' => 'weekly',
                'schedule_day' => 'Sun',
                'schedule_time' => '20:00',
                'is_enabled' => 1,
                'email_subject' => '🔥【目標必達】今週のビジター申込状況 ＆ 次回定例会への進捗',
                'email_html_body' => $this->getDefaultWeeklyVisitorStatusEmail(),
                'line_template_body' => $this->getDefaultWeeklyVisitorStatusLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'tuesday_visitor_intro' => [
                'id' => 'tuesday_visitor_intro',
                'title' => '今週参加するビジター紹介 (毎週火曜)',
                'category' => 'weekly',
                'schedule_type' => 'weekly',
                'schedule_day' => 'Tue',
                'schedule_time' => '12:00',
                'is_enabled' => 1,
                'email_subject' => '🤝【全員で歓迎！】今週の定例会に参加されるビジター様のご紹介',
                'email_html_body' => $this->getDefaultTuesdayVisitorIntroEmail(),
                'line_template_body' => $this->getDefaultTuesdayVisitorIntroLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'weekly_full_report' => [
                'id' => 'weekly_full_report',
                'title' => '週間レポート (集計・フォロー・アクション)',
                'category' => 'weekly',
                'schedule_type' => 'weekly',
                'schedule_day' => 'Sun',
                'schedule_time' => '21:00',
                'is_enabled' => 1,
                'email_subject' => '📊【ビジホス週報】ビジター申込集計・フォロー状況・アクション進捗',
                'email_html_body' => $this->getDefaultWeeklyFullReportEmail(),
                'line_template_body' => $this->getDefaultWeeklyFullReportLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'action_completed' => [
                'id' => 'action_completed',
                'title' => 'アクション完了報告・称賛速報',
                'category' => 'instant',
                'schedule_type' => 'instant',
                'schedule_day' => '',
                'schedule_time' => '',
                'is_enabled' => 1,
                'email_subject' => '🎉【ナイスアクション！】{{ビジター名}} 様のフォロー完了・称賛速報',
                'email_html_body' => $this->getDefaultActionCompletedEmail(),
                'line_template_body' => $this->getDefaultActionCompletedLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'today_due_tasks' => [
                'id' => 'today_due_tasks',
                'title' => '本日期限のタスクリマインド',
                'category' => 'daily',
                'schedule_type' => 'daily',
                'schedule_day' => '',
                'schedule_time' => '08:00',
                'is_enabled' => 1,
                'email_subject' => '⏰【本日対応】ビジターフォロー期限タスク一覧 ({{本日期限件数}}件)',
                'email_html_body' => $this->getDefaultTodayDueTasksEmail(),
                'line_template_body' => $this->getDefaultTodayDueTasksLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'new_visitor_applied' => [
                'id' => 'new_visitor_applied',
                'title' => 'ビジター新規申込速報',
                'category' => 'instant',
                'schedule_type' => 'instant',
                'schedule_day' => '',
                'schedule_time' => '',
                'is_enabled' => 1,
                'email_subject' => '🚀【新規申込速報】{{招待者名}} 様よりビジター申込がありました！',
                'email_html_body' => $this->getDefaultNewVisitorAppliedEmail(),
                'line_template_body' => $this->getDefaultNewVisitorAppliedLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ]
        ];
    }

    private function seedDefaults(): void {
        $defaults = $this->getDefaults();
        foreach ($defaults as $d) {
            $existing = $this->db->fetchOne("SELECT id FROM report_templates WHERE id = ?", [$d['id']]);
            if (!$existing) {
                $this->db->upsert('report_templates', $d, 'id');
            }
        }
    }

    public function getAll(): array {
        return $this->db->fetchAll("SELECT * FROM report_templates ORDER BY CASE 
            WHEN id = 'weekly_visitor_status' THEN 1
            WHEN id = 'tuesday_visitor_intro' THEN 2
            WHEN id = 'weekly_full_report' THEN 3
            WHEN id = 'action_completed' THEN 4
            WHEN id = 'today_due_tasks' THEN 5
            WHEN id = 'new_visitor_applied' THEN 6
            ELSE 7 END");
    }

    public function getById(string $id): ?array {
        return $this->db->fetchOne("SELECT * FROM report_templates WHERE id = ?", [$id]);
    }

    public function update(string $id, array $data): bool {
        $fields = [];
        $params = [];

        $allowed = ['title', 'schedule_type', 'schedule_day', 'schedule_time', 'is_enabled', 'email_subject', 'email_html_body', 'line_template_body', 'default_recipients'];
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = ?";
                $params[] = $data[$field];
            }
        }

        if (empty($fields)) return false;

        $fields[] = "updated_at = CURRENT_TIMESTAMP";
        $params[] = $id;

        $sql = "UPDATE report_templates SET " . implode(', ', $fields) . " WHERE id = ?";
        return $this->db->query($sql, $params) !== false;
    }

    public function toggleEnabled(string $id, int $isEnabled): bool {
        return $this->db->query("UPDATE report_templates SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [$isEnabled, $id]) !== false;
    }

    public function resetToDefault(string $id): ?array {
        $defaults = $this->getDefaults();
        if (!isset($defaults[$id])) return null;

        $target = $defaults[$id];
        $this->db->upsert('report_templates', $target, 'id');
        return $this->getById($id);
    }

    /* =========================================================================
       1. 今週のビジター申込状況 (毎週日曜 20:00)
       ========================================================================= */
    public function getDefaultWeeklyVisitorStatusEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
.kpi-grid { display: flex; gap: 10px; margin: 20px 0; }
.kpi-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
.kpi-val { font-size: 22px; font-weight: 900; font-family: monospace; color: #0071e3; }
.kpi-lbl { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
.mentor-box { background: #eff6ff; border-left: 4px solid #0071e3; padding: 14px 16px; border-radius: 0 12px 12px 0; margin: 16px 0; }
.btn { display: inline-block; background: #0071e3; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 16px; }
.table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
.table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 11px; color: #475569; }
.table td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:20px; font-weight:900; letter-spacing:-0.5px;">🔥 今週のビジター申込状況 ＆ 目標必達速報</h1>
    <div style="font-size:12px; opacity:0.8; margin-top:4px;">次回定例会: {{定例会日付}}</div>
  </div>
  <div class="content" style="padding: 24px;">
    <div class="mentor-box">
      <div style="font-weight:800; font-size:13px; color:#1e40af; margin-bottom:4px;">💡 ビジホスメンターからのメッセージ</div>
      <div style="font-size:13px; color:#1e3a8a; line-height:1.6;">
        {{メンターメッセージ}}
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-val">{{週間目標数}}名</div>
        <div class="kpi-lbl">今週の目標</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val">{{現在申込数}}名</div>
        <div class="kpi-lbl">現在申込数</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val" style="color: {{目標差分カラー}};">{{目標差分}}名</div>
        <div class="kpi-lbl">目標まであと</div>
      </div>
    </div>

    <h3 style="font-size:14px; font-weight:800; margin:20px 0 8px 0;">👏 招待貢献メンバー</h3>
    {{招待貢献メンバー一覧HTML}}

    <div style="text-align: center; margin-top: 24px;">
      <a href="{{ダッシュボードURL}}" class="btn">ダッシュボードで進捗を確認する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultWeeklyVisitorStatusLine(): string {
        return "🔥【目標必達】今週のビジター申込状況 📢\n\n次回定例会（{{定例会日付}}）に向けた現在の申込進捗です。\n\n■ 目標達成状況\n・今週の目標: {{週間目標数}}名\n・現在申込数: {{現在申込数}}名\n・目標まであと: {{目標差分}}名 (達成率 {{達成率}}%)\n\n■ 💡 メンターメッセージ\n{{メンターメッセージ}}\n\n■ 👏 招待貢献メンバー\n{{招待貢献メンバーLINE一覧}}\n\n全員で声を掛け合い、今週も目標を必ず必達させましょう！🔥\n▼ 進捗詳細\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       2. 今週参加するビジター紹介 (毎週火曜 12:00)
       ========================================================================= */
    public function getDefaultTuesdayVisitorIntroEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #0071e3; color: #ffffff; padding: 24px; text-align: center; }
.v-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.btn { display: inline-block; background: #0f172a; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 10px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:20px; font-weight:900;">🤝 今週参加されるビジター様のご紹介</h1>
    <div style="font-size:12px; opacity:0.9; margin-top:4px;">{{定例会日付}} 開催定例会</div>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-top:0;">
      今週の定例会には <strong>{{参加予定ビジター数}}名</strong> のゲストが参加予定です！<br>
      事前に専門分野やお困りごとを把握し、チャプター全員で最高のビジネスチャンスをお届けしましょう。
    </p>

    <h3 style="font-size:14px; font-weight:800; margin:16px 0 10px 0;">参加ビジター一覧</h3>
    {{参加予定ビジターカード一覧HTML}}

    <div style="text-align:center; margin-top:24px;">
      <a href="{{ダッシュボードURL}}" class="btn">カルテ＆事前情報を見る →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultTuesdayVisitorIntroLine(): string {
        return "🤝【全員で歓迎！】今週参加されるビジター様のご紹介 ✨\n\n{{定例会日付}}の定例会には、計 {{参加予定ビジター数}}名 のビジター様がご参加予定です！\n\n■ 参加ビジター一覧\n{{参加予定ビジターLINE一覧}}\n\n事前にチェックし、積極的な名刺交換とマッチングで最高の体験を提供しましょう！🤝\n▼ ビジター詳細カルテ\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       3. 週間活動総合レポート (毎週日曜 21:00)
       ========================================================================= */
    public function getDefaultWeeklyFullReportEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
.kpi-row { display: flex; gap: 10px; margin: 16px 0; }
.kpi-item { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:20px; font-weight:900;">📊 週間ビジホス総合レポート</h1>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 13px; color: #475569; margin-top:0;">今週のビジター申込集計、フォロー進捗、アクション完了状況のまとめです。</p>
    
    <div class="kpi-row">
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #0071e3;">{{週間申込数}}名</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">今週の申込数</div>
      </div>
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #059669;">{{完了アクション数}}件</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">完了アクション</div>
      </div>
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #dc2626;">{{残ToDo数}}件</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">要対応残数</div>
      </div>
    </div>

    <h3 style="font-size:14px; font-weight:800; margin:20px 0 8px 0;">フォロー中の重要ビジター</h3>
    {{フォロー中ビジターテーブルHTML}}

    <div style="text-align:center; margin-top:20px;">
      <a href="{{ダッシュボードURL}}" style="background:#0071e3; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">全体ダッシュボードを開く →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultWeeklyFullReportLine(): string {
        return "📊【ビジホス週報】週間活動総合レポート 📋\n\n今週のビジター活動とフォロー進捗のまとめです。\n\n■ 今週の成果サマリー\n・今週のビジター申込: {{週間申込数}}名\n・完了アクション数: {{完了アクション数}}件\n・現在フォロー中: {{フォロー中件数}}名\n・要対応To-Do残: {{残ToDo数}}件\n\n■ フォロー状況・重要トピックス\n{{フォロー中重要ビジターLINE一覧}}\n\n次週に向けてアクションのスピード完了をお願いします！🔥\n▼ ダッシュボード\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       4. アクション完了・称賛速報 (都度即時)
       ========================================================================= */
    public function getDefaultActionCompletedEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #059669; color: #ffffff; padding: 20px; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:18px; font-weight:900;">🎉 ナイスアクション！フォロー完了速報</h1>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin-top:0;">素晴らしいスピード対応！以下のフォローが完了しました。</p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 14px; font-weight: bold; color: #166534;">👏 担当者: {{担当者名}} 様</div>
      <div style="font-size: 13px; color: #15803d; margin-top: 6px;">ビジター: <strong>{{ビジター名}} 様</strong> ({{ビジター会社}} / 招待: {{招待者名}})</div>
      <div style="font-size: 13px; color: #15803d; margin-top: 4px;">完了内容: {{アクション内容}}</div>
      <div style="font-size: 12px; color: #4b5563; margin-top: 8px; border-top: 1px dashed #86efac; padding-top: 8px;">報告コメント: {{報告内容}}</div>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <a href="{{カルテURL}}" style="background:#0f172a; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">カルテを確認する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultActionCompletedLine(): string {
        return "🎉【ナイスアクション！】フォロー完了・称賛速報 ✨\n\n素晴らしいスピード対応です！👏\n\n・担当者: {{担当者名}} 様\n・ビジター: {{ビジター名}} 様 (招待: {{招待者名}})\n・完了内容: {{アクション内容}}\n・報告: {{報告内容}}\n\n積極的なフォローをチャプター全員で称賛しましょう！🙌\n▼ カルテ詳細\n{{カルテURL}}";
    }

    /* =========================================================================
       5. 本日期限のタスクリマインド (毎朝 08:00)
       ========================================================================= */
    public function getDefaultTodayDueTasksEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #dc2626; color: #ffffff; padding: 20px; text-align: center; }
.table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
.table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 11px; color: #475569; }
.table td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:18px; font-weight:900;">⏰ 本日期限のフォロータスク一覧</h1>
    <div style="font-size:12px; opacity:0.9; margin-top:4px;">本日 ({{本日日付}}) 期限: {{本日期限件数}}件</div>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-top:0;">
      本日が期日となっているビジターフォローアクションです。<br>
      ビジターとの信頼関係を築くため、本日中のご対応・完了報告をお願いいたします。
    </p>

    {{本日期限タスクテーブルHTML}}

    <div style="text-align: center; margin-top: 24px;">
      <a href="{{アクション管理URL}}" style="background:#dc2626; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">アクション管理で報告する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultTodayDueTasksLine(): string {
        return "⏰【本日期限】ビジターフォロータスク一覧 📋\n\n本日 ({{本日日付}}) が期日となっているアクションです。\n\n■ 本日期限のタスク ({{本日期限件数}}件)\n{{本日期限タスクLINE一覧}}\n\nフォロー漏れゼロを目指し、完了報告をお願いいたします！🔥\n▼ アクション報告はこちら\n{{アクション管理URL}}";
    }

    /* =========================================================================
       6. ビジター新規申込速報 (都度即時)
       ========================================================================= */
    public function getDefaultNewVisitorAppliedEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #0071e3; color: #ffffff; padding: 20px; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1 style="margin:0; font-size:18px; font-weight:900;">🚀 新規ビジター申込速報！</h1>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin-top:0;">{{招待者名}} 様より新しいビジター申込がありました！👏</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 15px; font-weight: 900; color: #0f172a;">{{ビジター名}} 様</div>
      <div style="font-size: 13px; color: #475569; margin-top: 4px;">会社・役職: {{ビジター会社}}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">専門分野: {{ビジターカテゴリー}}</div>
      <div style="font-size: 13px; color: #0071e3; margin-top: 6px; font-weight: bold;">参加予定日: {{参加予定日}}</div>
      <div style="font-size: 13px; color: #64748b; margin-top: 4px;">招待メンバー: <strong>{{招待者名}} 様</strong></div>
    </div>

    <div style="text-align: center; margin-top: 20px;">
      <a href="{{カルテURL}}" style="background:#0071e3; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">カルテを確認・準備する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultNewVisitorAppliedLine(): string {
        return "🚀【新規ビジター申込速報！】🎉\n\n{{招待者名}} 様より新しいビジター申込がありました！ナイス招待です！👏\n\n・ビジター: {{ビジター名}} 様\n・会社/専門: {{ビジター会社}} / {{ビジターカテゴリー}}\n・参加予定日: {{参加予定日}}\n・招待メンバー: {{招待者名}} 様\n\n当日最高の体験を提供できるよう、全員で事前準備を進めましょう！✨\n▼ ビジターカルテ\n{{カルテURL}}";
    }
}
