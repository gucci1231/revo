const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Report & Message Manager Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

  it('verifies Report Manager 2-column HTML elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-report-manager"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-report-manager"'), true);
    assert.strictEqual(indexHtml.includes('id="tab-btn-report-manager"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-item-meeting_recap"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-item-member_remind"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-item-weekly_summary"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-item-action_cleared"'), true);
    assert.strictEqual(indexHtml.includes('id="rm-badge-meeting_recap"'), true);
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
    assert.strictEqual(indexHtml.includes('function fetchReportTemplatesData'), true);
    assert.strictEqual(indexHtml.includes('function updateReportPreview'), true);
    assert.strictEqual(indexHtml.includes('function saveCurrentReportTemplate'), true);
    assert.strictEqual(indexHtml.includes('function resetCurrentReportTemplateToDefault'), true);
    assert.strictEqual(indexHtml.includes('function onReportToggleChange'), true);
    assert.strictEqual(indexHtml.includes('function sendTestReportEmail'), true);
    assert.strictEqual(indexHtml.includes('function copyReplacedLineReportText'), true);
    assert.strictEqual(indexHtml.includes('REPORT_TAGS'), true);
  });

  it('verifies ApiService routes for Reports API', () => {
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=list'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=update'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=toggle'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=reset'), true);
    assert.strictEqual(indexHtml.includes('/api/reports.php?action=send_mail'), true);
  });
});
