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
            is_enabled INTEGER DEFAULT 1,
            email_subject VARCHAR(255) NOT NULL,
            email_html_body TEXT NOT NULL,
            line_template_body TEXT NOT NULL,
            default_recipients TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )";
        $this->db->query($sql);

        // 初期デフォルトテンプレートの投入
        $count = $this->db->fetchOne("SELECT COUNT(*) as cnt FROM report_templates")['cnt'] ?? 0;
        if ($count == 0) {
            $this->seedDefaults();
        }
    }

    private function seedDefaults(): void {
        $defaults = [
            [
                'id' => 'meeting_recap',
                'title' => '定例会ビジター来訪＆フォロー速報',
                'category' => 'recap',
                'is_enabled' => 1,
                'email_subject' => '【ビジホス速報】{{定例会日付}} ビジター来訪報告＆フォローTo-Do',
                'email_html_body' => $this->getDefaultMeetingRecapEmail(),
                'line_template_body' => $this->getDefaultMeetingRecapLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            [
                'id' => 'member_remind',
                'title' => 'メンバー個別活動＆フォローリマインド',
                'category' => 'member',
                'is_enabled' => 1,
                'email_subject' => '【要対応】{{メンバー名}} 様のビジターフォロー状況と次回To-Do',
                'email_html_body' => $this->getDefaultMemberRemindEmail(),
                'line_template_body' => $this->getDefaultMemberRemindLine(),
                'default_recipients' => ''
            ],
            [
                'id' => 'weekly_summary',
                'title' => 'チャプター週間・月間成果サマリー',
                'category' => 'summary',
                'is_enabled' => 1,
                'email_subject' => '【ビジホス週報】今週のビジター成果・入会進捗・成約率レポート',
                'email_html_body' => $this->getDefaultWeeklySummaryEmail(),
                'line_template_body' => $this->getDefaultWeeklySummaryLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            [
                'id' => 'action_cleared',
                'title' => 'アクション完了・クエストクリア祝賀速報',
                'category' => 'celebration',
                'is_enabled' => 1,
                'email_subject' => '🎉【ナイスアクション！】{{ビジター名}} 様のフォローが完了しました',
                'email_html_body' => $this->getDefaultActionClearedEmail(),
                'line_template_body' => $this->getDefaultActionClearedLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ]
        ];

        foreach ($defaults as $d) {
            $this->db->upsert('report_templates', $d, 'id');
        }
    }

    public function getAll(): array {
        return $this->db->fetchAll("SELECT * FROM report_templates ORDER BY CASE 
            WHEN id = 'meeting_recap' THEN 1
            WHEN id = 'member_remind' THEN 2
            WHEN id = 'weekly_summary' THEN 3
            WHEN id = 'action_cleared' THEN 4
            ELSE 5 END");
    }

    public function getById(string $id): ?array {
        return $this->db->fetchOne("SELECT * FROM report_templates WHERE id = ?", [$id]);
    }

    public function update(string $id, array $data): bool {
        $fields = [];
        $params = [];

        $allowed = ['title', 'is_enabled', 'email_subject', 'email_html_body', 'line_template_body', 'default_recipients'];
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
        $defaults = [
            'meeting_recap' => [
                'id' => 'meeting_recap',
                'title' => '定例会ビジター来訪＆フォロー速報',
                'category' => 'recap',
                'is_enabled' => 1,
                'email_subject' => '【ビジホス速報】{{定例会日付}} ビジター来訪報告＆フォローTo-Do',
                'email_html_body' => $this->getDefaultMeetingRecapEmail(),
                'line_template_body' => $this->getDefaultMeetingRecapLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'member_remind' => [
                'id' => 'member_remind',
                'title' => 'メンバー個別活動＆フォローリマインド',
                'category' => 'member',
                'is_enabled' => 1,
                'email_subject' => '【要対応】{{メンバー名}} 様のビジターフォロー状況と次回To-Do',
                'email_html_body' => $this->getDefaultMemberRemindEmail(),
                'line_template_body' => $this->getDefaultMemberRemindLine(),
                'default_recipients' => ''
            ],
            'weekly_summary' => [
                'id' => 'weekly_summary',
                'title' => 'チャプター週間・月間成果サマリー',
                'category' => 'summary',
                'is_enabled' => 1,
                'email_subject' => '【ビジホス週報】今週のビジター成果・入会進捗・成約率レポート',
                'email_html_body' => $this->getDefaultWeeklySummaryEmail(),
                'line_template_body' => $this->getDefaultWeeklySummaryLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ],
            'action_cleared' => [
                'id' => 'action_cleared',
                'title' => 'アクション完了・クエストクリア祝賀速報',
                'category' => 'celebration',
                'is_enabled' => 1,
                'email_subject' => '🎉【ナイスアクション！】{{ビジター名}} 様のフォローが完了しました',
                'email_html_body' => $this->getDefaultActionClearedEmail(),
                'line_template_body' => $this->getDefaultActionClearedLine(),
                'default_recipients' => 'info@k-d-o.biz'
            ]
        ];

        if (!isset($defaults[$id])) return null;

        $target = $defaults[$id];
        $this->db->upsert('report_templates', $target, 'id');
        return $this->getById($id);
    }

    /* --- Default HTML Email Templates (Apple-Style Clean Responsive) --- */

    public function getDefaultMeetingRecapEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
.header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
.content { padding: 24px; }
.kpi-grid { display: flex; gap: 12px; margin: 20px 0; }
.kpi-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
.kpi-val { font-size: 22px; font-weight: 900; font-family: monospace; color: #0071e3; }
.kpi-lbl { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 2px; }
.table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
.table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 11px; color: #475569; border-bottom: 1px solid #cbd5e1; }
.table td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
.badge { display: inline-block; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 800; }
.badge-a { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
.badge-b { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.badge-c { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
.btn { display: inline-block; background: #0071e3; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 10px; margin-top: 16px; text-align: center; }
.footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>{{定例会日付}} ビジター来訪＆フォロー速報</h1>
  </div>
  <div class="content">
    <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-top: 0;">
      本日も定例会へのご参加・ビジター招待ありがとうございました！<br>
      本日のビジター来訪実績およびフォローTo-Doの速報をお届けします。
    </p>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-val">{{本日来訪数}}名</div>
        <div class="kpi-lbl">参加ビジター</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val">{{高感触A数}}名</div>
        <div class="kpi-lbl">Aランク (高感触)</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-val">{{要対応ToDo数}}件</div>
        <div class="kpi-lbl">要対応To-Do</div>
      </div>
    </div>

    <h3 style="font-size: 14px; font-weight: 800; margin: 20px 0 8px 0; color: #0f172a;">本日参加のビジター一覧</h3>
    {{来訪ビジターテーブルHTML}}

    <h3 style="font-size: 14px; font-weight: 800; margin: 20px 0 8px 0; color: #0f172a;">次回までの要対応アクション</h3>
    {{要対応アクションリストHTML}}

    <div style="text-align: center; margin-top: 24px;">
      <a href="{{ダッシュボードURL}}" class="btn">ビジホス管理画面でカルテを確認する →</a>
    </div>
  </div>
  <div class="footer">
    Visitor Host Revolution 2.0 | 送信元: info@k-d-o.biz
  </div>
</div>
</body>
</html>';
    }

    private function getDefaultMeetingRecapLine(): string {
        return "【ビジホス速報】{{定例会日付}} ビジター来訪＆フォロー報告 📢\n\n本日も定例会ありがとうございました！\n\n■ 本日の来訪実績\n・参加ビジター: {{本日来訪数}}名\n・高感触(Aランク): {{高感触A数}}名\n・要対応To-Do: {{要対応ToDo数}}件\n\n■ 参加ビジター一覧\n{{来訪ビジターLINE一覧}}\n\n■ 直近の要対応アクション\n{{要対応アクションLINE一覧}}\n\n▼ 各ビジターカルテ・進捗確認はこちら\n{{ダッシュボードURL}}\n\n次回に向けてスピード感を持ったフォローをお願いいたします！🔥";
    }

    private function getDefaultMemberRemindEmail(): string {
        return '<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
.card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.header { background: #0071e3; color: #ffffff; padding: 20px 24px; text-align: center; }
.header h1 { margin: 0; font-size: 18px; font-weight: 800; }
.content { padding: 24px; }
.todo-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.todo-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
.todo-due { font-size: 11px; font-weight: 700; color: #dc2626; }
.btn { display: inline-block; background: #0f172a; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 10px; margin-top: 16px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>{{メンバー名}} 様のビジターフォロー状況</h1>
  </div>
  <div class="content">
    <p style="font-size: 13px; color: #334155; line-height: 1.6;">
      いつもチャプターへの貢献ありがとうございます！<br>
      {{メンバー名}} 様が招待・担当されているゲストのフォロー状況と、現在やるべきTo-Doをお知らせします。
    </p>

    <h3 style="font-size: 14px; font-weight: 800; margin: 20px 0 10px 0;">担当To-Do一覧 ({{担当ToDo件数}}件)</h3>
    {{メンバー担当ToDoHTML}}

    <div style="text-align: center; margin-top: 24px;">
      <a href="{{メンバー個別URL}}" class="btn">専用ダッシュボードで確認する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    private function getDefaultMemberRemindLine(): string {
        return "【ビジホス】{{メンバー名}} 様のフォローリマインド 📋\n\n{{メンバー名}} 様が招待・担当されているビジターの次回アクションです。\n\n■ やるべきTo-Do ({{担当ToDo件数}}件)\n{{メンバー担当ToDoLINE}}\n\n▼ {{メンバー名}} 様専用ダッシュボード\n{{メンバー個別URL}}\n\nご確認のほどよろしくお願いいたします！✨";
    }

    private function getDefaultWeeklySummaryEmail(): string {
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
    <h1 style="margin:0; font-size:20px; font-weight:900;">チャプター週間・月間成果サマリー</h1>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 13px; color: #475569;">今週のビジター活動サマリーをお届けします。</p>
    <div class="kpi-row">
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #0071e3;">{{月間招待数}}名</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">今期招待ビジター</div>
      </div>
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #0f172a;">{{月間入会数}}名</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">入会決定数</div>
      </div>
      <div class="kpi-item">
        <div style="font-size: 20px; font-weight: 900; color: #059669;">{{成約率}}%</div>
        <div style="font-size: 10px; color: #64748b; font-weight: bold;">入会成約率</div>
      </div>
    </div>
    <div style="text-align:center; margin-top:20px;">
      <a href="{{ダッシュボードURL}}" style="background:#0071e3; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">全体ダッシュボードを開く →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    private function getDefaultWeeklySummaryLine(): string {
        return "【ビジホス週報】今週のビジター成果レポート 📊\n\n■ 成果サマリー\n・招待ビジター累計: {{月間招待数}}名\n・入会決定累計: {{月間入会数}}名\n・チャプター成約率: {{成約率}}%\n・フォロー中ビジター: {{フォロー中件数}}名\n\n▼ 全体ダッシュボード\n{{ダッシュボードURL}}";
    }

    private function getDefaultActionClearedEmail(): string {
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
    <h1 style="margin:0; font-size:18px; font-weight:900;">🎉 フォローアクション完了速報</h1>
  </div>
  <div class="content" style="padding: 24px;">
    <p style="font-size: 14px; font-weight: bold; color: #0f172a;">ナイスアクション！以下のフォローが完了しました。</p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0;">
      <div style="font-size: 13px; font-weight: bold; color: #166534;">ビジター: {{ビジター名}} 様</div>
      <div style="font-size: 13px; color: #15803d; margin-top: 4px;">完了内容: {{アクション内容}}</div>
      <div style="font-size: 12px; color: #4b5563; margin-top: 8px; border-top: 1px dashed #86efac; pt-2;">報告: {{報告内容}}</div>
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <a href="{{カルテURL}}" style="background:#0f172a; color:#fff; padding:10px 20px; text-decoration:none; border-radius:10px; font-weight:bold; font-size:13px;">カルテを確認する →</a>
    </div>
  </div>
</div>
</body>
</html>';
    }

    private function getDefaultActionClearedLine(): string {
        return "🎉【ナイスアクション！】フォロー完了報告 ✨\n\n・ビジター: {{ビジター名}} 様\n・担当: {{担当者名}}\n・完了内容: {{アクション内容}}\n・報告: {{報告内容}}\n\n▼ カルテ詳細\n{{カルテURL}}";
    }
}
