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

  it('renders feel rate badges correctly for rows with A, B, C ratings', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 4,
      feelCounts: { A: 2, B: 1, C: 1, none: 0 },
      feelRates: { A: '50.0%', B: '25.0%', C: '25.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('feel-rate-group'), 'Contains feel-rate-group wrapper');
    assert(html.includes('badge-feel-pill rank-A'), 'Contains A rank pill');
    assert(html.includes('A 50.0%'), 'Shows A percentage');
    assert(html.includes('badge-feel-pill rank-B'), 'Contains B rank pill');
    assert(html.includes('B 25.0%'), 'Shows B percentage');
    assert(html.includes('badge-feel-pill rank-C'), 'Contains C rank pill');
    assert(html.includes('C 25.0%'), 'Shows C percentage');
    assert(html.includes('title="感触 A: 2名 (50.0%)"'), 'Includes accurate count in tooltip');
  });

  it('omits 0 count ranks and renders only existing ranks', () => {
    const sandbox = getSandbox();
    const row = {
      applyCount: 2,
      feelCounts: { A: 2, B: 0, C: 0, none: 0 },
      feelRates: { A: '100.0%', B: '0.0%', C: '0.0%' }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(row);
    assert(html.includes('rank-A'), 'Contains A badge');
    assert(!html.includes('rank-B'), 'Does not contain B badge when count is 0');
    assert(!html.includes('rank-C'), 'Does not contain C badge when count is 0');
  });

  it('returns hyphen "-" when no feel ratings are present', () => {
    const sandbox = getSandbox();
    const rowEmpty = {
      applyCount: 3,
      feelCounts: { A: 0, B: 0, C: 0, none: 3 }
    };

    const html = sandbox.renderFeelRatesBadgeHtml(rowEmpty);
    assert(html.includes('-'), 'Returns hyphen placeholder for empty ratings');

    const htmlNull = sandbox.renderFeelRatesBadgeHtml(null);
    assert(htmlNull.includes('-'), 'Returns hyphen placeholder for null');
  });
});
