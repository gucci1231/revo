const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Report & Message Manager Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

  it('verifies Report Manager is accessible from settings and removed from main drawer navigation', () => {
    assert.strictEqual(indexHtml.includes('id="view-report-manager"'), true);
    // メインメニューには乗せず設定からアクセス
    assert.strictEqual(indexHtml.includes('id="drawer-item-report-manager"'), false);
    assert.strictEqual(indexHtml.includes('id="tab-btn-report-manager"'), false);
    assert.strictEqual(indexHtml.includes('id="settings-subtab-btn-reports"'), true);
  });

  it('verifies 6 Mentor Report types exist in compiled index.html', () => {
    // 1. 今週のビジター申込状況 (毎週日曜)
    assert.strictEqual(indexHtml.includes('id="rm-item-weekly_visitor_status"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-weekly_visitor_status"'), true);

    // 2. 今週参加するビジター紹介 (毎週火曜)
    assert.strictEqual(indexHtml.includes('id="rm-item-tuesday_visitor_intro"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-tuesday_visitor_intro"'), true);

    // 3. 週間レポート (毎週日曜)
    assert.strictEqual(indexHtml.includes('id="rm-item-weekly_full_report"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-weekly_full_report"'), true);

    // 4. アクション完了・称賛速報 (都度即時)
    assert.strictEqual(indexHtml.includes('id="rm-item-action_completed"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-action_completed"'), true);

    // 5. 本日期限のタスク (毎朝08:00)
    assert.strictEqual(indexHtml.includes('id="rm-item-today_due_tasks"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-today_due_tasks"'), true);

    // 6. ビジター新規申込速報 (都度即時)
    assert.strictEqual(indexHtml.includes('id="rm-item-new_visitor_applied"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-new_visitor_applied"'), true);
  });

  it('verifies Schedule & Timing controls exist in Report Manager', () => {
    assert.strictEqual(indexHtml.includes('id="rm-schedule-type"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-schedule-day"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-schedule-time"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-enabled-toggle"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-form-email"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-form-line"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-email-recipients"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-email-subject"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-email-body"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-line-body"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-preview-container-email"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-preview-container-line"'), true);
    assert.strictEqual(indexHtml.includes('info@k-d-o.biz'), true);
    assert.strictEqual(indexHtml.includes('resetCurrentReportTemplateToDefault'), true);
  });

  it('verifies Report Manager JS functions are defined', () => {
    assert.strictEqual(indexHtml.includes('function initReportManager'), true);
    assert.strictEqual(indexHtml.includes('function switchReportTab'), true);
    assert.strictEqual(indexHtml.includes('function switchReportChannel'), true);
    assert.strictEqual(indexHtml.includes('function onScheduleTypeChange'), true);
    assert.strictEqual(indexHtml.includes('function fetchReportTemplatesData'), true);
    assert.strictEqual(indexHtml.includes('function updateReportPreview'), true);
    assert.strictEqual(indexHtml.includes('function saveCurrentReportTemplate'), true);
    assert.strictEqual(indexHtml.includes('function resetCurrentReportTemplateToDefault'), true);
    assert.strictEqual(indexHtml.includes('function onReportToggleChange'), true);
    assert.strictEqual(indexHtml.includes('function sendTestReportEmail'), true);
    assert.strictEqual(indexHtml.includes('function copyReplacedLineReportText'), true);
    assert.strictEqual(indexHtml.includes('REPORT_TAGS'), true);
    assert.strictEqual(indexHtml.includes('ALL_REPORT_IDS'), true);
  });

  it('verifies Modern Code & Text Editor resources and toolbar features exist', () => {
    // CodeMirror CDN links & script tags
    assert.strictEqual(indexHtml.includes('codemirror.min.css'), true);
    assert.strictEqual(indexHtml.includes('codemirror.min.js'), true);
    assert.strictEqual(indexHtml.includes('mode/htmlmixed/htmlmixed.min.js'), true);

    // Modern editor wrappers & status bars
    assert.strictEqual(indexHtml.includes('id="rm-email-editor-wrapper"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-line-editor-wrapper"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-email-stat-lines"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-email-stat-chars"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-line-stat-lines"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-line-stat-chars"'), true);

    // Editor toolbar actions
    assert.strictEqual(indexHtml.includes('function ensureReportCodeEditors'), true);
    assert.strictEqual(indexHtml.includes('function setReportEditorValues'), true);
    assert.strictEqual(indexHtml.includes('function getReportEmailBodyValue'), true);
    assert.strictEqual(indexHtml.includes('function getReportLineBodyValue'), true);
    assert.strictEqual(indexHtml.includes('function execEmailEditorAction'), true);
    assert.strictEqual(indexHtml.includes('function execLineEditorAction'), true);
    assert.strictEqual(indexHtml.includes('function formatEmailHtmlCode'), true);
    assert.strictEqual(indexHtml.includes('function insertEmojiIntoLine'), true);
    assert.strictEqual(indexHtml.includes('function toggleEditorFullscreen'), true);
  });

  it('verifies ApiService routes for Reports API', () => {
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=list'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=update'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=toggle'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=reset'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=send_mail'), true);
  });
});
