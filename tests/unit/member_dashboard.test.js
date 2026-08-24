const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Member Personal Dashboard Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

  it('verifies Member Dashboard HTML elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-member-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('id="member-dash-select"'), true);
    assert.strictEqual(indexHtml.includes('id="member-single-dash-container"'), true);
    assert.strictEqual(indexHtml.includes('id="member-all-summary-container"'), true);
    assert.strictEqual(indexHtml.includes('id="member-todo-list"'), true);
    assert.strictEqual(indexHtml.includes('id="member-visitor-cards-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="all-members-summary-tbody"'), true);
  });

  it('verifies navigation items and icons are added to drawer and router', () => {
    assert.strictEqual(indexHtml.includes('id="drawer-item-member-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('PAGE_NAV_INFO'), true);
    assert.strictEqual(indexHtml.includes('member-dashboard'), true);
  });

  it('verifies member dashboard functions are defined in scripts', () => {
    assert.strictEqual(indexHtml.includes('function initMemberDashboard'), true);
    assert.strictEqual(indexHtml.includes('function selectMemberDashboard'), true);
    assert.strictEqual(indexHtml.includes('function getVisitorsByInviter'), true);
    assert.strictEqual(indexHtml.includes('function copyMemberDashUrl'), true);
    assert.strictEqual(indexHtml.includes('function copyMemberDashLineText'), true);
    assert.strictEqual(indexHtml.includes('function toggleAllMembersView'), true);
    assert.strictEqual(indexHtml.includes('function renderAllMembersSummaryTable'), true);
  });
});
