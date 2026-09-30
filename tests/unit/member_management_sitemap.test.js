const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Member Management Sitemap & PPW/RPW Accelerator Feature Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies all 5 Member Management Sitemap Subviews and navigation tabs exist in index.html', () => {
    // Sub-navigation tabs container
    assert.strictEqual(indexHtml.includes('id="palms-subnav-tabs"'), true);
    assert.strictEqual(indexHtml.includes('data-subtab="growth-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('data-subtab="ppw-rpw"'), true);
    assert.strictEqual(indexHtml.includes('data-subtab="traffic-lights"'), true);
    assert.strictEqual(indexHtml.includes('data-subtab="palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('data-subtab="chapter-traffic"'), true);

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
    assert.strictEqual(indexHtml.includes('BNI公式新基準 7大指標と配点（100点満点）'), true);
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
    assert.strictEqual(indexHtml.includes('function copyPpwGoalPlanText('), true);
    assert.strictEqual(indexHtml.includes('function renderTrafficLightsGrid('), true);
    assert.strictEqual(indexHtml.includes('function renderChapterTrafficView('), true);
  });
});
