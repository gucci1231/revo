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
    assert.strictEqual(indexHtml.includes('function calcBniTrafficLightScore'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsCharts'), true);
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

  it('verifies BNI Traffic Lights official 100-point scoring system and color tiers according to CSV', () => {
    // Extract calcBniTrafficLightScore from indexHtml or evaluate
    const calcFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(calcFnMatch, 'calcBniTrafficLightScore function must exist in indexHtml');

    const calcBniTrafficLightScore = new Function('r', 'weeks', calcFnMatch[1]);

    // 1. High Performer: All top tiers -> 100 pt (GREEN)
    // 26 weeks (6 months)
    // vis: 5 (25pt), tyfcb: 6,000,000 (5pt), oto: 26 (1/wk = 20pt), ref: 33 (1.26/wk = 25pt), sponsors: 1 (5pt), ceu: 14 (0.53/wk = 10pt), att: 25/25 (100% = 10pt)
    const memberGreen = {
      visitors: 5,
      tyfcb_yen: 6000000,
      one_to_ones: 26,
      total_referrals_given: 33,
      testimonials: 1,
      ceu: 14,
      p: 25, a: 0, l: 0, m: 0, s: 0
    };
    const resGreen = calcBniTrafficLightScore(memberGreen, 26);
    assert.strictEqual(resGreen.totalScore, 100);
    assert.strictEqual(resGreen.tier, 'green');

    // 2. Medium Performer (YELLOW): 50-69 pt
    // vis: 2 (10pt), tyfcb: 400,000 (2pt), oto: 13 (0.5/wk = 10pt), ref: 20 (0.76/wk = 15pt), sponsors: 0 (0pt), ceu: 8 (0.3/wk = 5pt), att: 23/25 (92% = 5pt)
    // total = 10 + 2 + 10 + 15 + 0 + 5 + 5 = 47 (Wait, let's bump ref to 1.0/wk = 20pt -> 52pt)
    const memberYellow = {
      visitors: 2,
      tyfcb_yen: 400000,
      one_to_ones: 13,
      total_referrals_given: 26, // 1.0/wk -> 20pt
      testimonials: 0,
      ceu: 8, // 5pt
      p: 23, a: 2, l: 0, m: 0, s: 0 // 92% -> 5pt
    };
    // 10 + 2 + 10 + 20 + 0 + 5 + 5 = 52
    const resYellow = calcBniTrafficLightScore(memberYellow, 26);
    assert.strictEqual(resYellow.totalScore, 52);
    assert.strictEqual(resYellow.tier, 'yellow');

    // 3. Low Performer (RED / GREY): < 50 pt
    const memberRed = {
      visitors: 1, // 5pt
      tyfcb_yen: 0, // 0pt
      one_to_ones: 7, // 0.26/wk -> 5pt
      total_referrals_given: 13, // 0.5/wk -> 10pt
      testimonials: 0, // 0pt
      ceu: 0, // 0pt
      p: 20, a: 5, l: 0, m: 0, s: 0 // 80% -> 0pt
    };
    // 5 + 0 + 5 + 10 + 0 + 0 + 0 = 20 (GREY)
    const resRed = calcBniTrafficLightScore(memberRed, 26);
    assert.strictEqual(resRed.totalScore, 20);
    assert.strictEqual(resRed.tier, 'grey');
  });

  it('verifies PPW and RPW calculation and 3 benchmark bands according to BNI guidelines', () => {
    const calcFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(calcFnMatch, 'calcBniTrafficLightScore function must exist in indexHtml');

    const calcBniTrafficLightScore = new Function('r', 'weeks', calcFnMatch[1]);

    // Test Case 1: 4 weeks, High PPW performer (>= 2.0000)
    // rgi=6, rgo=2, vis=2, testimonials=1, p=4, a=0, l=0, m=0, s=0
    // W = 4
    // RPW = (6 + 2) / 4 = 2.0000
    // PPW = (6 + 2 + 2 + 1) / 4 = 11 / 4 = 2.7500
    const m1 = {
      rgi: 6,
      rgo: 2,
      total_referrals_given: 8,
      visitors: 2,
      testimonials: 1,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res1 = calcBniTrafficLightScore(m1, 4);
    assert.strictEqual(res1.rpw, 2.0);
    assert.strictEqual(res1.ppw, 2.75);
    assert.strictEqual(res1.ppwTier, 'high'); // >= 2.0

    // Test Case 2: 4 weeks, Mid PPW performer (1.0000 <= PPW < 2.0000)
    // rgi=2, rgo=1, vis=1, testimonials=1, p=4
    // RPW = 3 / 4 = 0.7500
    // PPW = (3 + 1 + 1) / 4 = 5 / 4 = 1.2500
    const m2 = {
      rgi: 2,
      rgo: 1,
      total_referrals_given: 3,
      visitors: 1,
      testimonials: 1,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res2 = calcBniTrafficLightScore(m2, 4);
    assert.strictEqual(res2.rpw, 0.75);
    assert.strictEqual(res2.ppw, 1.25);
    assert.strictEqual(res2.ppwTier, 'mid'); // 1.0 - 2.0

    // Test Case 3: 4 weeks, Low PPW performer (< 1.0000)
    // rgi=1, rgo=0, vis=0, testimonials=0, p=4
    // RPW = 1 / 4 = 0.2500
    // PPW = 1 / 4 = 0.2500
    const m3 = {
      rgi: 1,
      rgo: 0,
      total_referrals_given: 1,
      visitors: 0,
      testimonials: 0,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res3 = calcBniTrafficLightScore(m3, 4);
    assert.strictEqual(res3.rpw, 0.25);
    assert.strictEqual(res3.ppw, 0.25);
    assert.strictEqual(res3.ppwTier, 'low'); // < 1.0
  });

  it('verifies flexible period selection elements exist in compiled index.html', () => {
    // Preset period pills
    assert.strictEqual(indexHtml.includes('id="palms-period-presets"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="4weeks"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="term2"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="2years"'), true);

    // Custom date range controls
    assert.strictEqual(indexHtml.includes('id="palms-custom-period-bar"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-custom-start"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-custom-end"'), true);
    assert.strictEqual(indexHtml.includes('onclick="applyCustomPalmsPeriod()"'), true);

    // PPW and RPW KPI cards
    assert.strictEqual(indexHtml.includes('id="palms-kpi-avg-ppw"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-kpi-avg-rpw"'), true);

    // PPW Chart
    assert.strictEqual(indexHtml.includes('id="chart-palms-ppw-bar"'), true);

    // Metric filter buttons for PPW and RPW
    assert.strictEqual(indexHtml.includes('data-metric="ppw"'), true);
    assert.strictEqual(indexHtml.includes('data-metric="rpw"'), true);
  });

  it('verifies PALMS member detail modal UI elements and script functions exist', () => {
    // Modal container
    assert.strictEqual(indexHtml.includes('id="modal-palms-detail"'), true);
    assert.strictEqual(indexHtml.includes('id="modal-palms-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-name"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-tier-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-ppw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-rpw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-scores-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-history-tbody"'), true);

    // Raw numbers
    assert.strictEqual(indexHtml.includes('id="palms-raw-p"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-raw-ref-total"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-raw-visitors"'), true);

    // Script functions
    assert.strictEqual(indexHtml.includes('function openPalmsDetailModal('), true);
    assert.strictEqual(indexHtml.includes('function closePalmsDetailModal('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailScores('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailRawBreakdown('), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsMemberHistory('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailHistory('), true);

    // ApiService mapping
    assert.strictEqual(indexHtml.includes('getPalmsMemberHistoryApi'), true);

    // Podium and Table calls openPalmsDetailModal
    assert.strictEqual(indexHtml.includes("openPalmsDetailModal('${memberNameSafe}')"), true);
  });
});


