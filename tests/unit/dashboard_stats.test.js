const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Dashboard Periodic Stats & Feel Rates Tests', () => {
  function getSandbox() {
    const sandbox = {
      window: {},
      document: {
        getElementById: () => null,
        createElement: () => ({ innerHTML: '', appendChild: () => {} })
      },
      console: console,
      renderNextMeetingTable: () => {},
      renderLastMeetingTable: () => {},
      renderHotVisitorsTable: () => {},
      renderActionPlansTable: () => {},
      renderOneMonthTable: () => {},
      renderWeeklyStatsTable: () => {},
      renderMonthlyStatsTable: () => {},
      initLineChart: () => {},
      isVisitorActionCompleted: () => false
    };

    const utilsScriptPath = path.join(__dirname, '../../src/scripts/Utils.html');
    let utilsCode = fs.readFileSync(utilsScriptPath, 'utf8');
    utilsCode = utilsCode.replace(/<\/?script>/g, '');

    const viewDashboardScriptPath = path.join(__dirname, '../../src/scripts/ViewDashboard.html');
    let code = fs.readFileSync(viewDashboardScriptPath, 'utf8');
    code = code.replace(/<\/?script>/g, '');
    vm.createContext(sandbox);
    vm.runInContext(utilsCode, sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
  }

  it('renders feel rates in sleek monochromatic stacked bar format with tooltip', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 4,
      feelCounts: { A: 2, B: 1, C: 1, none: 0 },
      feelRates: { A: '50.0%', B: '25.0%', C: '25.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('feel-meter-wrap'), 'Renders feel-meter-wrap container');
    assert(html.includes('seg-a') && html.includes('width: 50.0%'), 'Renders seg-a with 50% width');
    assert(html.includes('seg-b') && html.includes('width: 25.0%'), 'Renders seg-b with 25% width');
    assert(html.includes('seg-c') && html.includes('width: 25.0%'), 'Renders seg-c with 25% width');
    assert(html.includes('title="感触: A: 2名 (50.0%) | B: 1名 (25.0%) | C: 1名 (25.0%)"'), 'Includes accurate count and rate in tooltip');
  });

  it('displays 0 count ratings gracefully in progress bar', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 2,
      feelCounts: { A: 2, B: 0, C: 0, none: 0 },
      feelRates: { A: '100.0%', B: '0.0%', C: '0.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('seg-a') && html.includes('width: 100.0%'), 'Renders 100% for A');
    assert(!html.includes('seg-b'), 'Omits 0% segment seg-b from bar for clean render');
    assert(!html.includes('seg-c'), 'Omits 0% segment seg-c from bar for clean render');
  });

  it('returns hyphen "-" when row is null or empty', () => {
    const sandbox = getSandbox();
    const htmlNull = sandbox.renderFeelRatesBadgeHtml(null);
    assert(htmlNull.includes('-'), 'Returns hyphen placeholder for null');
  });

  it('correctly updates SVG circular progress rings and applies success class for >= 100%', () => {
    const sandbox = getSandbox();
    const mockCircle = {
      style: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const mockText = { innerText: '' };

    sandbox.document.getElementById = (id) => {
      if (id === 'test-circle') return mockCircle;
      if (id === 'test-text') return mockText;
      return null;
    };

    // Test 75% (Blue by default)
    sandbox.updateKpiProgressRing('test-circle', 'test-text', 75, false, 'blue');
    assert.strictEqual(mockText.innerText, 75);
    assert.strictEqual(mockCircle.className, 'kpi-ring-fill blue');
    const expectedOffset75 = (2 * Math.PI * 20) * (1 - 0.75);
    assert(Math.abs(parseFloat(mockCircle.style.strokeDashoffset) - expectedOffset75) < 0.01, 'Correct offset for 75%');

    // Test Red forcedColor (e.g. Warning / Bad state)
    sandbox.updateKpiProgressRing('test-circle', 'test-text', 40, false, 'red');
    assert.strictEqual(mockText.innerText, 40);
    assert.strictEqual(mockCircle.className, 'kpi-ring-fill red');
    assert.strictEqual(mockText.className, 'kpi-ring-value text-red-600');
  });

  it('correctly calculates weekly goal achievement and updates UI elements', () => {
    const sandbox = getSandbox();
    const mockElements = {};
    const getMock = (id) => {
      if (!mockElements[id]) {
        mockElements[id] = {
          innerText: '',
          style: {},
          classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
          }
        };
      }
      return mockElements[id];
    };

    sandbox.document.getElementById = (id) => getMock(id);

    // Test with >0 (normal / blue dot)
    const testDataNormal = {
      metrics: {
        nextThuCount: 4,
        targetVisitorsWeekly: 4,
        joinedCount: 3,
        targetJoinGoal: 12,
        applyCount: 20
      },
      tables: {
        nextMeeting: [{}, {}, {}, {}]
      }
    };

    sandbox.renderDashboard(testDataNormal);

    assert.strictEqual(getMock('val-next-thu-count').innerText, 4);
    assert.strictEqual(getMock('val-target-weekly-goal').innerText, 4);
    assert.strictEqual(getMock('badge-weekly-status').className, 'kpi-status-dot blue');

    // Test with 0 (warning / red dot)
    const testDataZero = {
      metrics: {
        nextThuCount: 0,
        targetVisitorsWeekly: 4,
        joinedCount: 3,
        targetJoinGoal: 12,
        applyCount: 20
      },
      tables: {
        nextMeeting: []
      }
    };

    sandbox.renderDashboard(testDataZero);
    assert.strictEqual(getMock('val-next-thu-count').innerText, 0);
    assert.strictEqual(getMock('badge-weekly-status').className, 'kpi-status-dot red');
  });
});


