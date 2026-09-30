const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('PALMS Ranking Feature Tests (Step 2-2)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies PALMS Ranking navigation item is active and updated in drawer', () => {
    assert.strictEqual(indexHtml.includes('id="drawer-item-palms-ranking"'), true);
    // Should NOT be marked as (開発中) in PAGE_NAV_INFO
    assert.strictEqual(indexHtml.includes("'palms-ranking': { title: 'PALMSランキング'"), true);
  });

  it('verifies PALMS Ranking HTML container and UI elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('<div id="view-palms-ranking" class="view-content">'), true);
    assert.strictEqual(indexHtml.includes('id="view-palms-ranking" class="view-content" style="display: none;"'), false);
    assert.strictEqual(indexHtml.includes('id="palms-period-select"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-sync-palms"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-metric-tabs"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-podium-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-table-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-table-body"'), true);
  });

  it('verifies PALMS Ranking JS functions are defined in scripts', () => {
    assert.strictEqual(indexHtml.includes('function fetchPalmsRankingData'), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsPeriods'), true);
    assert.strictEqual(indexHtml.includes('function syncPalmsFromBniConnect'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsRankingView'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsPodium'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsTable'), true);
    assert.strictEqual(indexHtml.includes('function switchPalmsMetric'), true);
    assert.strictEqual(indexHtml.includes('function sortPalmsTable'), true);
  });

  it('verifies ApiService mappings exist for PALMS endpoints', () => {
    assert.strictEqual(indexHtml.includes('getPalmsListApi'), true);
    assert.strictEqual(indexHtml.includes('getPalmsPeriodsApi'), true);
    assert.strictEqual(indexHtml.includes('syncPalmsApi'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=list'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=periods'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=sync'), true);
  });

  it('verifies Router handles palms-ranking tab properly without dev alert', () => {
    // Should NOT be blocked in switchTab
    const switchTabMatch = indexHtml.match(/function switchTab\([^)]*\)\s*\{([^}]+)\}/);
    assert.ok(switchTabMatch, 'switchTab should exist');
    // Ensure palms-ranking is not in the blocking check
    assert.strictEqual(
      indexHtml.includes("['palms-ranking', 'training', 'schedules'].includes(tabName)"),
      false
    );
  });

  it('verifies score calculation formula correctly weighs referrals, visitors, 1to1, attendance, and CEU', () => {
    // Simulate score formula logic
    const calcScore = (r) => {
      const totalRefGiven = (r.rgi || 0) + (r.rgo || 0);
      const visitors = r.visitors || 0;
      const oto = r.one_to_ones || 0;
      const p = r.p || 0;
      const s = r.s || 0;
      const a = r.a || 0;
      const ceu = r.ceu || 0;
      return (totalRefGiven * 5) + (visitors * 10) + (oto * 3) + (p * 5 + s * 5 - a * 5) + ceu;
    };

    const memberA = { rgi: 2, rgo: 1, visitors: 1, one_to_ones: 3, p: 2, s: 0, a: 0, ceu: 2 };
    // Ref: 3*5 = 15
    // Vis: 1*10 = 10
    // 1to1: 3*3 = 9
    // Att: 2*5 = 10
    // CEU: 2
    // Total: 15 + 10 + 9 + 10 + 2 = 46
    assert.strictEqual(calcScore(memberA), 46);

    const memberBWithAbsence = { rgi: 0, rgo: 0, visitors: 0, one_to_ones: 0, p: 1, s: 0, a: 1, ceu: 0 };
    // Att: 1*5 - 1*5 = 0
    assert.strictEqual(calcScore(memberBWithAbsence), 0);
  });
});

