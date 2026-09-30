const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Member Personal Dashboard Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const htaccess = fs.readFileSync(path.join(process.cwd(), '.htaccess'), 'utf8');

  it('verifies Member Dashboard HTML elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-member-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-select"'), true);
    assert.strictEqual(indexHtml.includes('id="member-single-dash-container"'), true);
    assert.strictEqual(indexHtml.includes('id="member-all-summary-container"'), true);
    assert.strictEqual(indexHtml.includes('id="member-kpi-orient-count"'), true);
    assert.strictEqual(indexHtml.includes('id="member-kpi-orient-joined-count"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-closing-rate"'), true);
    assert.strictEqual(indexHtml.includes('id="member-activity-chart"'), true);
    assert.strictEqual(indexHtml.includes('id="member-feel-donut-chart"'), true);
    assert.strictEqual(indexHtml.includes('id="member-feel-donut-center"'), true);
    assert.strictEqual(indexHtml.includes('id="tab-role-invited"'), true);
    assert.strictEqual(indexHtml.includes('id="tab-role-oriented"'), true);
    assert.strictEqual(indexHtml.includes('id="tab-action-pending"'), true);
    assert.strictEqual(indexHtml.includes('id="tab-action-completed"'), true);
    assert.strictEqual(indexHtml.includes('id="member-todo-list"'), true);
    assert.strictEqual(indexHtml.includes('id="member-visitor-cards-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="all-members-summary-tbody"'), true);
  });

  it('verifies member dashboard is accessible from settings and not in main navigation drawer', () => {
    assert.strictEqual(indexHtml.includes('id="drawer-item-member-dashboard"'), false);
    assert.strictEqual(indexHtml.includes('switchTab(\'member-dashboard\')'), true);
    assert.strictEqual(indexHtml.includes('メンバー別活動ダッシュボード'), true);
    assert.strictEqual(indexHtml.includes('PAGE_NAV_INFO'), true);
  });

  it('verifies member dashboard functions are defined in scripts and supports ID-based clean routing, orientation, closing, charts, and completed actions', () => {
    assert.strictEqual(indexHtml.includes('function initMemberDashboard'), true);
    assert.strictEqual(indexHtml.includes('function selectMemberDashboard'), true);
    assert.strictEqual(indexHtml.includes('function resolveMemberFromParam'), true);
    assert.strictEqual(indexHtml.includes('function getVisitorsByInviter'), true);
    assert.strictEqual(indexHtml.includes('function getVisitorsByOrientationUser'), true);
    assert.strictEqual(indexHtml.includes('function switchMemberRoleView'), true);
    assert.strictEqual(indexHtml.includes('function filterMemberActionList'), true);
    assert.strictEqual(indexHtml.includes('function initMemberActivityChart'), true);
    assert.strictEqual(indexHtml.includes('function initMemberFeelDonutChart'), true);
    assert.strictEqual(indexHtml.includes('function getMemberNameFromUrl'), true);
    assert.strictEqual(indexHtml.includes('deduplicateVisitorListClient'), true);
    assert.strictEqual(indexHtml.includes('renderStandardVisitorCardHtml'), true);
    assert.strictEqual(indexHtml.includes('function copyMemberDashUrl'), true);
    assert.strictEqual(indexHtml.includes('function copyMemberDashLineText'), true);
    assert.strictEqual(indexHtml.includes('function toggleAllMembersView'), true);
    assert.strictEqual(indexHtml.includes('function renderAllMembersSummaryTable'), true);
    // .htaccess rewrite rule for /member/{name} or /member/{id}
    assert.strictEqual(htaccess.includes('RewriteRule ^member/(.+)$ index.html [L,QSA]'), true);
  });

  it('verifies Personal Scores (Traffic Lights & PALMS) integration in Member Dashboard', () => {
    // UI Elements in Member Dashboard
    assert.strictEqual(indexHtml.includes('id="member-dash-subtabs"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-subtab-traffic"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-subtab-visitors"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-subview-traffic"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-subview-visitors"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="member-tl-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="member-tl-ppw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="member-tl-rpw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="member-chart-palms-radar"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-scores-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-weekly-tbody"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-period-tabs"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-chart-history"'), true);

    // Script Functions
    assert.strictEqual(indexHtml.includes('function switchMemberDashboardSubTab'), true);
    assert.strictEqual(indexHtml.includes('function navigateBackFromMemberDashboard'), true);
    assert.strictEqual(indexHtml.includes('function renderMemberPalmsPersonalScores'), true);
    assert.strictEqual(indexHtml.includes('function renderMemberPalmsRadarChart'), true);
    assert.strictEqual(indexHtml.includes('function renderMemberPalmsScoresGrid'), true);
    assert.strictEqual(indexHtml.includes('function renderMemberPalmsRawBreakdown'), true);
    assert.strictEqual(indexHtml.includes('function navigateToMemberPersonalDashboard'), true);

    // Traffic light card click navigates to dashboard instead of standalone modal
    assert.strictEqual(indexHtml.includes('navigateToMemberPersonalDashboard'), true);
  });

  it('verifies chapter average (みんなの統計) indicators and 3-dataset radar chart in Member Dashboard', () => {
    // 3-KPI card chapter averages
    assert.strictEqual(indexHtml.includes('id="member-tl-score-avg"'), true);
    assert.strictEqual(indexHtml.includes('id="member-tl-ppw-avg"'), true);
    assert.strictEqual(indexHtml.includes('id="member-tl-rpw-avg"'), true);

    // Radar chart legend & datasets
    assert.strictEqual(indexHtml.includes('チャプター平均 (%)'), true);
    assert.strictEqual(indexHtml.includes('member-radar-legend-text'), true);
    assert.strictEqual(indexHtml.includes('みんなの統計'), true);

    // fetchPalmsRankingData returns Promise
    assert.strictEqual(indexHtml.includes('return activePalmsFetchPromise;'), true);

    // Past 6-month radar chart badge and fetching
    assert.strictEqual(indexHtml.includes('id="member-palms-radar-period-badge"'), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsHalfYearRecords'), true);
    assert.strictEqual(indexHtml.includes('function parseAndProcessPalmsRecords'), true);
  });
});

