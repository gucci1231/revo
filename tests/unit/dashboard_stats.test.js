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

  it('renders feel rates in plain text format with A, B, C percentages', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 4,
      feelCounts: { A: 2, B: 1, C: 1, none: 0 },
      feelRates: { A: '50.0%', B: '25.0%', C: '25.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('A: 50.0%'), 'Shows A percentage');
    assert(html.includes('B: 25.0%'), 'Shows B percentage');
    assert(html.includes('C: 25.0%'), 'Shows C percentage');
    assert(html.includes('title="感触内訳: A: 2名 (50.0%), B: 1名 (25.0%), C: 1名 (25.0%)"'), 'Includes accurate count in tooltip');
  });

  it('displays 0% ratings without omitting them', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 2,
      feelCounts: { A: 2, B: 0, C: 0, none: 0 },
      feelRates: { A: '100.0%', B: '0.0%', C: '0.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('A: 100.0%'), 'Contains A 100.0%');
    assert(html.includes('B: 0.0%'), 'Contains B 0.0%');
    assert(html.includes('C: 0.0%'), 'Contains C 0.0%');
  });

  it('returns hyphen "-" when row is null', () => {
    const sandbox = getSandbox();
    const htmlNull = sandbox.renderFeelRatesBadgeHtml(null);
    assert(htmlNull.includes('-'), 'Returns hyphen placeholder for null');
  });
});
