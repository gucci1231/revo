const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Chapter Traffic Lights 100pt Scoring Criteria Feature Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies Chapter Traffic Lights (100pt) UI elements exist in palms-subview-traffic-lights', () => {
    // Traffic lights subview contains Chapter Traffic score header and card
    assert.strictEqual(indexHtml.includes('id="ctl-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-tier-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-hero-dot"'), true);
    assert.strictEqual(indexHtml.includes('チャプタートラフィック'), true);

    // 7 Core Evaluated Metrics elements
    assert.strictEqual(indexHtml.includes('id="ctl-size-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-size-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-growth-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-growth-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-retention-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-retention-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-referral-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-referral-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-visitor-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-visitor-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-join-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-join-score"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-absent-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-absent-score"'), true);

    // 4 Reference Metrics elements
    assert.strictEqual(indexHtml.includes('id="ctl-ext-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-tyfcb-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-ceu-val"'), true);
    assert.strictEqual(indexHtml.includes('id="ctl-oto-val"'), true);
  });

  it('verifies Official Criteria Modal exists with accurate table and definition text', () => {
    assert.strictEqual(indexHtml.includes('id="modal-chapter-traffic-criteria"'), true);
    assert.strictEqual(indexHtml.includes('チャプタートラフィックの点数基準'), true);
    assert.strictEqual(indexHtml.includes('チャプターレベルスコア配点表 (参考)'), true);
    assert.strictEqual(indexHtml.includes('51 人 ≦'), true);
    assert.strictEqual(indexHtml.includes('70 % ≦ (69.99%超)'), true);
    assert.strictEqual(indexHtml.includes('1.5 超'), true);
    assert.strictEqual(indexHtml.includes('8.0 超'), true);
    assert.strictEqual(indexHtml.includes('20 % 超 (10点満点)'), true);
    assert.strictEqual(indexHtml.includes('≦ 1.75 %'), true);
    assert.strictEqual(indexHtml.includes('項目の定義'), true);
  });

  it('verifies calculation and modal trigger functions are defined in scripts', () => {
    assert.strictEqual(indexHtml.includes('function calcAndRenderChapterTrafficScore('), true);
    assert.strictEqual(indexHtml.includes('function toggleChapterTrafficCriteriaModal('), true);
    assert.strictEqual(indexHtml.includes('function closeChapterTrafficCriteriaModal('), true);
  });
});
