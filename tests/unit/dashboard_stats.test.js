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

  it('renders feel rates in stacked progress meter format with tooltip and count labels', () => {
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
    assert(html.includes('A 2'), 'Shows A count label');
    assert(html.includes('B 1'), 'Shows B count label');
    assert(html.includes('C 1'), 'Shows C count label');
    assert(html.includes('title="感触内訳: A: 2名 (50.0%), B: 1名 (25.0%), C: 1名 (25.0%)"'), 'Includes accurate count in tooltip');
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
    assert(html.includes('A 2'), 'Contains A 2');
    assert(html.includes('B 0'), 'Contains B 0');
    assert(html.includes('C 0'), 'Contains C 0');
  });

  it('returns hyphen "-" when row is null or empty', () => {
    const sandbox = getSandbox();
    const htmlNull = sandbox.renderFeelRatesBadgeHtml(null);
    assert(htmlNull.includes('-'), 'Returns hyphen placeholder for null');
  });
});
