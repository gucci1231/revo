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
      console: console
    };

    const viewDashboardScriptPath = path.join(__dirname, '../../src/scripts/ViewDashboard.html');
    let code = fs.readFileSync(viewDashboardScriptPath, 'utf8');
    code = code.replace(/<\/?script>/g, '');
    vm.createContext(sandbox);
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

    // Test 75%
    sandbox.updateKpiProgressRing('test-circle', 'test-text', 75, true);
    assert.strictEqual(mockText.innerText, 75);
    assert(!mockCircle.classList.contains('success'), 'Does not have success class at 75%');
    const expectedOffset75 = (2 * Math.PI * 20) * (1 - 0.75);
    assert(Math.abs(parseFloat(mockCircle.style.strokeDashoffset) - expectedOffset75) < 0.01, 'Correct offset for 75%');

    // Test 120% (>= 100%)
    sandbox.updateKpiProgressRing('test-circle', 'test-text', 120, true);
    assert.strictEqual(mockText.innerText, 120);
    assert(mockCircle.classList.contains('success'), 'Has success class at >= 100%');
    assert.strictEqual(parseFloat(mockCircle.style.strokeDashoffset), 0, 'Offset is 0 for 100%+');
  });
});

