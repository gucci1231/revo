<?php
namespace Api\Repositories;

use Api\Core\Database;

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
        $this->db->getPdo()->exec($sql);

        // カラム追加（既存テーブルがある場合）
        try {
            $cols = $this->db->fetchAll("PRAGMA table_info(report_templates)");
            $colNames = array_column($cols, 'name');
            if (!in_array('schedule_type', $colNames)) {
                $this->db->getPdo()->exec("ALTER TABLE report_templates ADD COLUMN schedule_type VARCHAR(32) DEFAULT 'weekly'");
            }
            if (!in_array('schedule_day', $colNames)) {
                $this->db->getPdo()->exec("ALTER TABLE report_templates ADD COLUMN schedule_day VARCHAR(32) DEFAULT 'Sun'");
            }
            if (!in_array('schedule_time', $colNames)) {
                $this->db->getPdo()->exec("ALTER TABLE report_templates ADD COLUMN schedule_time VARCHAR(32) DEFAULT '20:00'");
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
                'email_subject' => '🔥【今週の目標必達】次回定例会({{定例会日付}})ビジター申込進捗 ＆ メンターメッセージ',
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
                'email_subject' => '🤝【全員で大歓迎！】今週参加されるビジター様のご紹介',
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
                'email_subject' => '📊【ビジホス週報】今週のビジター成果・フォロー状況・次週アクション方針',
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
                'email_subject' => '🎉【ナイスアクション！】{{担当者名}} 様によるビジターフォロー完了・称賛速報！',
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
                'email_subject' => '⏰【本日期限】ビジターフォロータスク一覧 ({{本日期限件数}}件)',
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
                'email_subject' => '🚀【新規ビジター申込速報！】{{招待者名}} 様より申込がありました！ナイス招待！👏',
                'email_html_body' => $this->getDefaultNewVisitorAppliedEmail(),
                'line_template_body' => $this->getDefaultNewVisitorAppliedLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ]
        ];
    }

    private function seedDefaults(): void {
        $defaults = $this->getDefaults();
        foreach ($defaults as $d) {
            $existing = $this->db->fetchOne("SELECT id, email_html_body, line_template_body FROM report_templates WHERE id = ?", [$d['id']]);
            if (!$existing) {
                $this->db->upsert('report_templates', $d, ['id']);
            } else if (empty(trim($existing['email_html_body'] ?? '')) || empty(trim($existing['line_template_body'] ?? '')) || strpos($existing['email_html_body'], 'brand-tag') === false) {
                // 自動的に最新のStripe風モダンデザインに更新
                $this->db->upsert('report_templates', $d, ['id']);
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
        return $this->db->execute($sql, $params) >= 0;
    }

    public function toggleEnabled(string $id, int $isEnabled): bool {
        return $this->db->execute("UPDATE report_templates SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [$isEnabled, $id]) >= 0;
    }

    public function resetToDefault(string $id): ?array {
        $defaults = $this->getDefaults();
        if (!isset($defaults[$id])) return null;

        $target = $defaults[$id];
        $this->db->upsert('report_templates', $target, ['id']);
        return $this->getById($id);
    }

    /* =========================================================================
       1. 今週のビジター申込状況 (毎週日曜 20:00) - Stripe Style
       ========================================================================= */
    public function getDefaultWeeklyVisitorStatusEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #0071e3; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #8898aa; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #0071e3; margin-bottom: 20px; }
.callout-box { background: #f0f7ff; border: 1px solid #d0e5ff; border-left: 4px solid #0071e3; border-radius: 10px; padding: 14px 16px; margin: 18px 0; }
.callout-title { font-size: 12px; font-weight: 700; color: #005bb5; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.callout-text { font-size: 12.5px; color: #1e3a8a; line-height: 1.6; margin: 0; }
.metrics-row { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 20px 0; }
.metric-card { background: #f8fafc; border: 1px solid #e6ebf1; border-radius: 10px; padding: 14px 8px; text-align: center; vertical-align: middle; }
.metric-val { font-size: 22px; font-weight: 900; color: #0a2540; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; line-height: 1.1; }
.metric-lbl { font-size: 10px; font-weight: 700; color: #8898aa; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.3px; }
.section-title { font-size: 13px; font-weight: 700; color: #0a2540; margin: 22px 0 10px 0; display: flex; align-items: center; justify-content: space-between; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">R</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">Weekly Goal Status</div>
  </div>
  
  <div class="content">
    <h1 class="heading">次回定例会 ビジター申込進捗</h1>
    <div class="subheading">次回開催: {{定例会日付}}</div>

    <div class="callout-box">
      <div class="callout-title">💡 メンターメッセージ</div>
      <p class="callout-text">
        定例会まであと2日となりました！<br>
        今週の目標【{{週間目標数}}名】に対し、現在の確定申込は【{{現在申込数}}名】、目標達成まであと<strong>【{{目標差分}}名】</strong>です。<br>
        日曜夜の今こそ、力になりたいビジネスパートナーに「火曜朝、一緒に参加しませんか？」と声を届ける最高のタイミングです。全員で必ず目標を達成させましょう！🔥
      </p>
    </div>

    <!-- 3 Metrics Cards -->
    <table class="metrics-row">
      <tr>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val">{{週間目標数}}名</div>
          <div class="metric-lbl">今週の目標</div>
        </td>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val" style="color: #0071e3;">{{現在申込数}}名</div>
          <div class="metric-lbl">確定申込数</div>
        </td>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val" style="color: {{目標差分カラー}};">あと{{目標差分}}名</div>
          <div class="metric-lbl">達成まで ({{達成率}}%)</div>
        </td>
      </tr>
    </table>

    <div class="section-title">
      <span>👏 先行招待メンバーの貢献</span>
    </div>
    {{招待貢献メンバー一覧HTML}}

    <div class="btn-container">
      <a href="{{ダッシュボードURL}}" class="btn">最新の進捗ダッシュボードを開く →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultWeeklyVisitorStatusLine(): string {
        return "🔥【目標必達メンター速報】今週のビジター申込進捗 📢\n\n次回定例会（{{定例会日付}}）に向けた現在の申込状況です！\n\n■ 🎯 目標達成状況\n・今週の目標: {{週間目標数}}名\n・現在申込数: {{現在申込数}}名\n・目標まであと: 【{{目標差分}}名】 (達成率 {{達成率}}%)\n\n■ 💡 メンターメッセージ\n日曜夜の今こそ、あなたの大切なビジネスパートナーに「火曜朝にお茶しませんか？」と声を届ける最高のチャンスです！\n妥協せず全員で声を掛け合い、今週も目標を必ず必達させましょう！🔥\n\n■ 👏 先行招待メンバー\n{{招待貢献メンバーLINE一覧}}\n\n▼ 進捗ダッシュボード\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       2. 今週参加するビジター紹介 (毎週火曜 12:00) - Stripe Style
       ========================================================================= */
    public function getDefaultTuesdayVisitorIntroEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #0071e3; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #8898aa; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #0071e3; margin-bottom: 16px; }
.intro-text { font-size: 13px; line-height: 1.65; color: #425466; margin: 0 0 20px 0; }
.section-title { font-size: 13px; font-weight: 700; color: #0a2540; margin: 20px 0 10px 0; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">R</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">Guest Introduction</div>
  </div>
  
  <div class="content">
    <h1 class="heading">🤝 今週参加されるビジター様のご紹介</h1>
    <div class="subheading">{{定例会日付}} 開催定例会 (参加予定: {{参加予定ビジター数}}名)</div>

    <p class="intro-text">
      今週の定例会には <strong>計 {{参加予定ビジター数}}名</strong> の素晴らしいゲストが参加されます！<br>
      事前に専門分野やお困りごとを把握し、チャプター全員で前のめりに歓迎と最高のビジネスチャンスをお届けしましょう。
    </p>

    <div class="section-title">参加ビジター一覧 ＆ 見どころ</div>
    {{参加予定ビジターカード一覧HTML}}

    <div class="btn-container">
      <a href="{{ダッシュボードURL}}" class="btn">カルテ＆事前情報を確認する →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultTuesdayVisitorIntroLine(): string {
        return "🤝【全員で大歓迎！】今週参加されるビジター様のご紹介 ✨\n\n{{定例会日付}}の定例会には、計 {{参加予定ビジター数}}名 のビジター様がご参加予定です！\n\n■ 参加ビジター一覧 ＆ 専門分野\n{{参加予定ビジターLINE一覧}}\n\n事前にチェックし、積極的な名刺交換とマッチングで最高の体験を提供しましょう！🤝\n▼ ビジター詳細カルテ\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       3. 週間活動総合レポート (毎週日曜 21:00) - Stripe Style
       ========================================================================= */
    public function getDefaultWeeklyFullReportEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #0071e3; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #8898aa; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #635bff; margin-bottom: 16px; }
.intro-text { font-size: 13px; line-height: 1.65; color: #425466; margin: 0 0 18px 0; }
.metrics-row { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 18px 0; }
.metric-card { background: #f8fafc; border: 1px solid #e6ebf1; border-radius: 10px; padding: 14px 8px; text-align: center; vertical-align: middle; }
.metric-val { font-size: 22px; font-weight: 900; color: #0a2540; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; line-height: 1.1; }
.metric-lbl { font-size: 10px; font-weight: 700; color: #8898aa; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.3px; }
.section-title { font-size: 13px; font-weight: 700; color: #0a2540; margin: 22px 0 10px 0; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">R</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">Weekly Summary Report</div>
  </div>
  
  <div class="content">
    <h1 class="heading">📊 週間ビジホス総合レポート</h1>
    <div class="subheading">ビジター申込集計・フォロー状況・アクション進捗</div>

    <p class="intro-text">
      今週のビジター活動サマリーをお届けします。フォロー中のゲストを確実に入会へ導くため、スピード感を持ってアクションを完了させましょう。
    </p>

    <!-- 3 Metrics Cards -->
    <table class="metrics-row">
      <tr>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val" style="color: #0071e3;">{{週間申込数}}名</div>
          <div class="metric-lbl">今週の申込数</div>
        </td>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val" style="color: #059669;">{{完了アクション数}}件</div>
          <div class="metric-lbl">完了アクション</div>
        </td>
        <td class="metric-card" style="width: 33.3%;">
          <div class="metric-val" style="color: #dc2626;">{{残ToDo数}}件</div>
          <div class="metric-lbl">要対応残数</div>
        </td>
      </tr>
    </table>

    <div class="section-title">🔥 フォロー中の重要ビジター</div>
    {{フォロー中ビジターテーブルHTML}}

    <div class="btn-container">
      <a href="{{ダッシュボードURL}}" class="btn">全体ダッシュボードを開く →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultWeeklyFullReportLine(): string {
        return "📊【ビジホス週報】週間活動総合レポート 📋\n\n今週のビジター活動とフォロー進捗のまとめです。\n\n■ 成果サマリー\n・今週のビジター申込: {{週間申込数}}名\n・完了アクション数: {{完了アクション数}}件\n・現在フォロー中: {{フォロー中件数}}名\n・要対応To-Do残: 【{{残ToDo数}}件】\n\n■ 🔥 フォロー状況・重要トピックス\n{{フォロー中重要ビジターLINE一覧}}\n\n次週に向けてアクションのスピード完了をお願いします！🔥\n▼ ダッシュボード\n{{ダッシュボードURL}}";
    }

    /* =========================================================================
       4. アクション完了・称賛速報 (都度即時) - Stripe Style
       ========================================================================= */
    public function getDefaultActionCompletedEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #059669; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #059669; margin-bottom: 16px; }
.intro-text { font-size: 13px; line-height: 1.65; color: #425466; margin: 0 0 18px 0; }
.receipt-card { background: #f8fafc; border: 1px solid #e6ebf1; border-radius: 12px; padding: 20px; margin: 18px 0; }
.receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 12.5px; }
.receipt-row:last-child { border-bottom: none; }
.receipt-label { color: #8898aa; font-weight: 600; width: 30%; }
.receipt-value { color: #0a2540; font-weight: 700; width: 70%; text-align: right; }
.comment-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 12px; font-size: 12px; color: #334155; line-height: 1.6; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">✓</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">Action Completed</div>
  </div>
  
  <div class="content">
    <h1 class="heading">🎉 ナイスアクション！フォロー完了</h1>
    <div class="subheading">迅速なフォローとチャプター貢献を称賛します！</div>

    <p class="intro-text">
      担当メンバーによるフォローアクションが完了しました。迅速な対応が信頼を深め、確実な入会へと繋がります！
    </p>

    <!-- Receipt Card -->
    <div class="receipt-card">
      <table style="width:100%; font-size:12.5px; border-collapse:collapse;">
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">担当メンバー</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:800; text-align:right; border-bottom:1px solid #edf2f7;"><span style="background:#eff6ff; color:#0071e3; padding:2px 8px; border-radius:6px;">{{担当者名}} 様</span></td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">対象ビジター</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;">{{ビジター名}} 様 <span style="font-size:11px; color:#64748b;">({{ビジター会社}})</span></td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">招待メンバー</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;">{{招待者名}} 様</td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">完了アクション</td>
          <td style="padding:7px 0; color:#059669; font-weight:800; text-align:right; border-bottom:1px solid #edf2f7;">{{アクション内容}}</td>
        </tr>
      </table>

      <div class="comment-box">
        <strong style="color:#0a2540; font-size:11px; display:block; margin-bottom:4px;">💬 報告コメント:</strong>
        {{報告内容}}
      </div>
    </div>

    <div class="btn-container">
      <a href="{{カルテURL}}" class="btn">ビジターカルテを確認する →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultActionCompletedLine(): string {
        return "🎉【ナイスアクション！】フォロー完了・称賛速報 ✨\n\n素晴らしいスピード対応です！👏\n\n・担当メンバー: {{担当者名}} 様\n・ビジター: {{ビジター名}} 様 (招待: {{招待者名}} 様)\n・完了内容: {{アクション内容}}\n・報告コメント: {{報告内容}}\n\n積極的なフォローと貢献をチャプター全員で称賛しましょう！🙌\n▼ カルテ詳細\n{{カルテURL}}";
    }

    /* =========================================================================
       5. 本日期限のタスクリマインド (毎朝 08:00) - Stripe Style
       ========================================================================= */
    public function getDefaultTodayDueTasksEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #dc2626; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #dc2626; margin-bottom: 16px; }
.intro-text { font-size: 13px; line-height: 1.65; color: #425466; margin: 0 0 18px 0; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">!</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">Action Due Today</div>
  </div>
  
  <div class="content">
    <h1 class="heading">⏰ 本日期限のフォロータスク</h1>
    <div class="subheading">本日 ({{本日日付}}) 期限: {{本日期限件数}}件</div>

    <p class="intro-text">
      ビジターの熱量は定例会直後が最も高いです！信頼関係を深め、入会へ繋げるため、本日中のご対応・完了報告をお願いいたします。🔥
    </p>

    {{本日期限タスクテーブルHTML}}

    <div class="btn-container">
      <a href="{{アクション管理URL}}" class="btn">アクション管理で報告する →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultTodayDueTasksLine(): string {
        return "⏰【本日期限】ビジターフォロータスク一覧 📋\n\n本日 ({{本日日付}}) が期日となっているアクションです。\n\n■ 本日期限のタスク ({{本日期限件数}}件)\n{{本日期限タスクLINE一覧}}\n\nフォロー漏れゼロを目指し、スピード対応と完了報告をお願いいたします！🔥\n▼ アクション報告はこちら\n{{アクション管理URL}}";
    }

    /* =========================================================================
       6. ビジター新規申込速報 (都度即時) - Stripe Style
       ========================================================================= */
    public function getDefaultNewVisitorAppliedEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif; background-color: #f6f9fc; margin: 0; padding: 32px 16px; color: #425466; -webkit-font-smoothing: antialiased; }
.wrapper { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02); }
.brand-bar { padding: 20px 28px; border-bottom: 1px solid #f0f4f8; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { font-size: 13px; font-weight: 800; color: #0a2540; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 8px; }
.brand-icon { width: 22px; height: 22px; background: #0071e3; color: #ffffff; border-radius: 6px; display: inline-block; text-align: center; line-height: 22px; font-size: 11px; font-weight: 900; }
.brand-tag { font-size: 10px; font-weight: 700; color: #0071e3; text-transform: uppercase; letter-spacing: 0.5px; }
.content { padding: 28px; }
.heading { font-size: 19px; font-weight: 800; color: #0a2540; margin: 0 0 6px 0; letter-spacing: -0.3px; line-height: 1.35; }
.subheading { font-size: 12px; font-weight: 600; color: #0071e3; margin-bottom: 16px; }
.intro-text { font-size: 13px; line-height: 1.65; color: #425466; margin: 0 0 18px 0; }
.profile-card { background: #f8fafc; border: 1px solid #e6ebf1; border-radius: 12px; padding: 20px; margin: 18px 0; }
.btn-container { text-align: center; margin-top: 26px; }
.btn { display: inline-block; background: #0071e3; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 113, 227, 0.2); }
.footer { background: #fafbfc; border-top: 1px solid #e6ebf1; padding: 18px 28px; text-align: center; font-size: 11px; color: #8898aa; line-height: 1.6; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="brand-bar">
    <div class="brand-logo">
      <span class="brand-icon">R</span> REVO VISITOR HOST
    </div>
    <div class="brand-tag">New Registration</div>
  </div>
  
  <div class="content">
    <h1 class="heading">🚀 新規ビジター申込速報！</h1>
    <div class="subheading">{{招待者名}} 様より新しいビジター申込がありました！👏</div>

    <p class="intro-text">
      メンバーの積極的な招待活動により、新しいビジターの参加申込が届きました！当日最高の体験を提供できるよう、全員で事前準備を進めましょう。
    </p>

    <!-- Profile Card -->
    <div class="profile-card">
      <table style="width:100%; font-size:12.5px; border-collapse:collapse;">
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">ビジター氏名</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:800; font-size:14px; text-align:right; border-bottom:1px solid #edf2f7;">{{ビジター名}} 様</td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">会社名・役職</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;">{{ビジター会社}}</td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">専門分野</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:700; text-align:right; border-bottom:1px solid #edf2f7;"><span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:6px;">{{ビジターカテゴリー}}</span></td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600; border-bottom:1px solid #edf2f7;">参加予定日</td>
          <td style="padding:7px 0; color:#0071e3; font-weight:800; text-align:right; border-bottom:1px solid #edf2f7;">{{参加予定日}}</td>
        </tr>
        <tr>
          <td style="padding:7px 0; color:#8898aa; font-weight:600;">招待メンバー</td>
          <td style="padding:7px 0; color:#0a2540; font-weight:800; text-align:right;"><span style="background:#eff6ff; color:#0071e3; padding:2px 8px; border-radius:6px;">{{招待者名}} 様</span></td>
        </tr>
      </table>
    </div>

    <div class="btn-container">
      <a href="{{カルテURL}}" class="btn">ビジターカルテを開く・準備する →</a>
    </div>
  </div>

  <div class="footer">
    REVO Chapter Visitor Host Revolution<br>
    送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    public function getDefaultNewVisitorAppliedLine(): string {
        return "🚀【新規ビジター申込速報！】🎉\n\n{{招待者名}} 様より新しいビジター申込がありました！ナイス招待です！👏\n\n・ビジター: {{ビジター名}} 様\n・会社/専門: {{ビジター会社}} / {{ビジターカテゴリー}}\n・参加予定日: {{参加予定日}}\n・招待メンバー: {{招待者名}} 様\n\n当日最高の体験を提供できるよう、全員で事前準備を進めましょう！✨\n▼ ビジターカルテ\n{{カルテURL}}";
    }
}

