const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Date Formatting Unit Tests (MM/DD)', () => {
  function getSandbox() {
    const sandbox = {
      window: {},
      document: {
        getElementById: () => null,
        createElement: () => ({ innerHTML: '', appendChild: () => {} })
      },
      console: console
    };

    const utilsScriptPath = path.join(__dirname, '../../src/scripts/Utils.html');
    let utilsCode = fs.readFileSync(utilsScriptPath, 'utf8');
    utilsCode = utilsCode.replace(/<\/?script>/g, '');
    vm.createContext(sandbox);
    vm.runInContext(utilsCode, sandbox);
    return sandbox;
  }

  it('correctly formats various date string formats to MM/DD', () => {
    const sandbox = getSandbox();
    const formatShortDate = sandbox.formatShortDate;

    // YYYY/MM/DD
    assert.strictEqual(formatShortDate('2026/08/24'), '08/24');
    assert.strictEqual(formatShortDate('2026/01/05'), '01/05');

    // YYYY-MM-DD
    assert.strictEqual(formatShortDate('2026-08-24'), '08/24');
    assert.strictEqual(formatShortDate('2026-04-01'), '04/01');

    // Single digit month/day: YYYY/M/D
    assert.strictEqual(formatShortDate('2026/8/4'), '08/04');
    assert.strictEqual(formatShortDate('2026-4-1'), '04/01');

    // Already MM/DD
    assert.strictEqual(formatShortDate('08/24'), '08/24');
    assert.strictEqual(formatShortDate('8/4'), '08/04');

    // Datetime with time component
    assert.strictEqual(formatShortDate('2026-08-24 14:30:00'), '08/24');
    assert.strictEqual(formatShortDate('2026/08/24 09:00'), '08/24');

    // Empty / null / special cases
    assert.strictEqual(formatShortDate(''), '');
    assert.strictEqual(formatShortDate(null), '');
    assert.strictEqual(formatShortDate(undefined), '');
    assert.strictEqual(formatShortDate('-'), '-');
    assert.strictEqual(formatShortDate('未定'), '未定');
    assert.strictEqual(formatShortDate('期日未定'), '期日未定');
  });

  it('formatEventDateWithElapsed strips year and uses MM/DD format', () => {
    const sandbox = getSandbox();
    const formatEventDateWithElapsed = sandbox.formatEventDateWithElapsed;

    const html = formatEventDateWithElapsed('2026/08/24');
    assert(html.includes('08/24'), 'Output contains 08/24');
    assert(!html.includes('2026'), 'Output does NOT contain the year 2026');
  });

  it('renderCurrentStatusColumnHtml uses MM/DD format for due dates', () => {
    const sandbox = getSandbox();
    const renderCurrentStatusColumnHtml = sandbox.renderCurrentStatusColumnHtml;

    const mockRecord = {
      latestActionPlan: {
        id: '101',
        action_text: '1to1日程調整',
        due_date: '2026-09-15',
        is_completed: 0,
        assignee_name: '田中'
      }
    };

    const html = renderCurrentStatusColumnHtml(mockRecord);
    assert(html.includes('期日: 09/15'), 'Action plan due date is formatted as MM/DD');
    assert(!html.includes('2026-09-15'), 'Full YYYY-MM-DD is not shown');
  });
});
