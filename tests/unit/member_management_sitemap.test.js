const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Member Management Sitemap & PPW/RPW Accelerator Feature Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies all 5 Member Management items exist in side drawer menu and subviews exist in index.html', () => {
    // Side drawer navigation items requested by user
    assert.strictEqual(indexHtml.includes('id="drawer-item-growth-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-ppw-rpw"'), true);
    assert.strictEqual(indexHtml.includes('全員2.0へ'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-traffic-lights"'), true);
    assert.strictEqual(indexHtml.includes('100点'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-chapter-traffic"'), true);

    // 5 Subviews HTML containers
    assert.strictEqual(indexHtml.includes('id="palms-subview-growth-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-subview-ppw-rpw"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-subview-traffic-lights"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-subview-palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-subview-chapter-traffic"'), true);
  });

  it('verifies PPW & RPW Improvement Accelerator elements and core philosophy exist', () => {
    // Core philosophy statement
    assert.strictEqual(indexHtml.includes('数字を「評価」ではなく「改善」に使い、全員でPPW 2.0000のラインへ'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-achievement-rate"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-qualified-count"'), true);

    // 3-Tier Follow-up Extraction Filter Cards
    assert.strictEqual(indexHtml.includes('id="ppw-filter-urgent"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-filter-stepup"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-filter-benchmark"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-count-urgent"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-count-stepup"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-count-benchmark"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-follow-member-grid"'), true);

    // PPW 2.0000 Reverse Goal Simulator
    assert.strictEqual(indexHtml.includes('id="ppw-sim-member-select"'), true);
    assert.strictEqual(indexHtml.includes('id="ppw-sim-result-container"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-copy-ppw-plan"'), true);

    // Top Performer Best Practice & Knowledge Sharing
    assert.strictEqual(indexHtml.includes('上位メンバーの行動傾向・ベストプラクティス'), true);
    assert.strictEqual(indexHtml.includes('id="top-avg-oto"'), true);
    assert.strictEqual(indexHtml.includes('id="top-ext-ratio"'), true);
    assert.strictEqual(indexHtml.includes('id="top-avg-v"'), true);
  });

  it('verifies Personal Traffic Lights (100pt Diagnosis) elements exist', () => {
    assert.strictEqual(indexHtml.includes('id="traffic-light-member-cards"'), true);
    assert.strictEqual(indexHtml.includes('id="traffic-light-summary-green-pct"'), true);
    assert.strictEqual(indexHtml.includes('id="traffic-light-zone-filters"'), true);
  });

  it('verifies Chapter Traffic Lights Matrix elements exist', () => {
    assert.strictEqual(indexHtml.includes('id="chapter-traffic-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="chapter-metric-size"'), true);
    assert.strictEqual(indexHtml.includes('id="chapter-metric-retention"'), true);
    assert.strictEqual(indexHtml.includes('id="chapter-metric-attendance"'), true);
    assert.strictEqual(indexHtml.includes('id="chapter-metric-rpw"'), true);
    assert.strictEqual(indexHtml.includes('id="chapter-metric-visitors"'), true);
  });

  it('verifies Member Management Sitemap JavaScript functions are defined', () => {
    assert.strictEqual(indexHtml.includes('function switchPalmsSubTab('), true);
    assert.strictEqual(indexHtml.includes('function renderGrowthDashboardSummary('), true);
    assert.strictEqual(indexHtml.includes('function renderPpwRpwHub('), true);
    assert.strictEqual(indexHtml.includes('function filterPpwFollowList('), true);
    assert.strictEqual(indexHtml.includes('function renderPpwFollowMemberGrid('), true);
    assert.strictEqual(indexHtml.includes('function selectMemberForPpwSim('), true);
    assert.strictEqual(indexHtml.includes('function runPpwGoalSimulation('), true);
    assert.strictEqual(indexHtml.includes('function renderTrafficLightsGrid('), true);
    assert.strictEqual(indexHtml.includes('function renderMiniRadarSvg('), true);
    assert.strictEqual(indexHtml.includes('function renderChapterTrafficView('), true);
  });

  it('verifies weekly and period granularity toggle controls and functions for Chapter Growth Trend', () => {
    // UI elements
    assert.strictEqual(indexHtml.includes('id="btn-palms-trend-weekly"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-palms-trend-period"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-trend-chart-title"'), true);
    assert.strictEqual(indexHtml.includes('毎週刻み'), true);
    assert.strictEqual(indexHtml.includes('2年間期別'), true);

    // JS functions & API mappings
    assert.strictEqual(indexHtml.includes('function setGrowthTrendGranularity('), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsChapterTrends('), true);
    assert.strictEqual(indexHtml.includes('function renderChapterTrendLineChart('), true);
    assert.strictEqual(indexHtml.includes('getPalmsChapterTrendsApi'), true);
    assert.strictEqual(indexHtml.includes('週平均/人'), true);
    assert.strictEqual(indexHtml.includes('件/人/週'), true);

    // Straight line & zero point dots verification
    assert.strictEqual(indexHtml.includes('tension: 0,'), true);
    assert.strictEqual(indexHtml.includes('pointRadius: 0,'), true);
    assert.strictEqual(indexHtml.includes('pointHoverRadius: 0,'), true);
    assert.strictEqual(indexHtml.includes('fill: false,'), true);
  });

  it('verifies 3-period achievement cards (1 Month, 6 Months, All Time) and 6 core metrics in Growth Dashboard', () => {
    // 3 Period Card headers & elements
    assert.strictEqual(indexHtml.includes('1ヶ月の成果'), true);
    assert.strictEqual(indexHtml.includes('半年間の成果'), true);
    assert.strictEqual(indexHtml.includes('全期間の成果'), true);

    // 6 Core metric elements for 1 Month
    assert.strictEqual(indexHtml.includes('id="growth-tyfcb-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-total-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-ext-rate-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-visitors-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-oto-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ceu-1m"'), true);

    // 6 Core metric elements for 6 Months
    assert.strictEqual(indexHtml.includes('id="growth-tyfcb-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-total-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-ext-rate-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-visitors-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-oto-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ceu-6m"'), true);

    // 6 Core metric elements for All Time
    assert.strictEqual(indexHtml.includes('id="growth-tyfcb-all"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-total-all"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ref-ext-rate-all"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-visitors-all"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-oto-all"'), true);
    assert.strictEqual(indexHtml.includes('id="growth-ceu-all"'), true);

    // 6 Indicators Quick Comparison Matrix Table
    assert.strictEqual(indexHtml.includes('6大指標 期間別実績マトリクス'), true);
    assert.strictEqual(indexHtml.includes('id="tbl-growth-tyfcb-1m"'), true);
    assert.strictEqual(indexHtml.includes('id="tbl-growth-tyfcb-6m"'), true);
    assert.strictEqual(indexHtml.includes('id="tbl-growth-tyfcb-all"'), true);

    // Script functions for formatting TYFCB yen
    assert.strictEqual(indexHtml.includes('function formatTyfcbYenDisplay('), true);
  });

  it('verifies PPW consists of referrals + visitors + testimonials in member dashboard and PPW-RPW subview', () => {
    // Member Dashboard PPW card breakdown includes referrals, visitors, and testimonials
    assert.strictEqual(indexHtml.includes('内訳: 紹介'), true);
    assert.strictEqual(indexHtml.includes('推薦'), true);

    // Activity slip chart legend includes 推薦の言葉
    assert.strictEqual(indexHtml.includes('>推薦の言葉</span>'), true);

    // PPW member follow grid quick metrics include 推薦の言葉 (not 1to1)
    assert.strictEqual(indexHtml.includes('Quick Metrics (4 items: RPW, リファーラル, ビジター, 推薦の言葉)'), true);

    // Goal simulator has 推薦の言葉 action card
    assert.strictEqual(indexHtml.includes('推薦状・証言'), true);

    // Copy plan text mentions referrals + visitors + testimonials
    assert.strictEqual(indexHtml.includes('【推奨アクション (リファーラル＋ビジター＋推薦の言葉)】'), true);
  });

  it('strictly separates 推薦の言葉 (testimonials) from スポンサー (sponsors) in member dashboard and traffic light scoring', () => {
    // Member Dashboard raw breakdown must say 推薦の言葉, not 推薦/スポンサー
    assert.strictEqual(indexHtml.includes('id="member-palms-raw-testimonials"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-raw-testimonials"'), true);
    assert.strictEqual(indexHtml.includes('推薦/スポンサー'), false);
    assert.strictEqual(indexHtml.includes('推薦状・スポンサー'), false);

    // Traffic light sponsor card must say 新会員スポンサー
    assert.strictEqual(indexHtml.includes("title: '新会員スポンサー'"), true);

    // Verify calcBniTrafficLightScore does NOT award sponsor points solely for testimonials
    const calcFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(calcFnMatch);
    const calcBniTrafficLightScore = new Function('r', 'weeks', calcFnMatch[1]);

    // Member has 3 testimonials (推薦の言葉), but 0 sponsors
    const memberWithTestimonialsOnly = {
      visitors: 0,
      total_referrals_given: 0,
      one_to_ones: 0,
      testimonials: 3,
      sponsors: 0,
      p: 4
    };
    const res = calcBniTrafficLightScore(memberWithTestimonialsOnly, 4);
    // Sponsors score must be 0!
    assert.strictEqual(res.scores.sponsor, 0);
    // PPW must include testimonials: (0 + 0 + 3) / 4 = 0.75
    assert.strictEqual(res.ppw, 0.75);

    // Member has 1 sponsor (新会員スポンサー) -> 5 pt
    const memberWithSponsor = {
      visitors: 0,
      total_referrals_given: 0,
      one_to_ones: 0,
      testimonials: 0,
      sponsors: 1,
      p: 4
    };
    const resSponsor = calcBniTrafficLightScore(memberWithSponsor, 4);
    assert.strictEqual(resSponsor.scores.sponsor, 5);
  });
});

