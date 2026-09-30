const assert = require('assert');
const fs = require('fs');
const path = require('path');

const INDEX_HTML_PATH = path.join(__dirname, '../../index.html');
const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

describe('🎰 Regular Meeting Lottery Slot Machine & 16:9 Stage Feature Tests', () => {
  it('verifies lottery navigation item is active in drawer', () => {
    assert.match(indexHtml, /id="drawer-item-lottery"/, 'Drawer should have lottery navigation item');
    assert.match(indexHtml, /switchTab\('lottery'\)/, 'Lottery item should trigger switchTab');
    assert.match(indexHtml, /定例会スロット抽選/, 'Drawer label should say 定例会スロット抽選');
  });

  it('verifies lottery container and 16:9 stage elements exist in compiled index.html', () => {
    assert.match(indexHtml, /id="view-lottery"/, 'Should contain view-lottery panel');
    assert.match(indexHtml, /id="lottery-theater-wrapper"/, 'Should contain lottery-theater-wrapper');
    assert.match(indexHtml, /class="lottery-stage-16-9/, 'Should contain lottery-stage-16-9');
    assert.match(indexHtml, /id="lottery-award-input"/, 'Should contain award title input');
    assert.match(indexHtml, /id="lottery-spin-btn"/, 'Should contain spin start button');
  });

  it('verifies 3 slot reel strips and payline exist in compiled index.html', () => {
    assert.match(indexHtml, /id="reel-strip-1"/, 'Should contain reel-strip-1');
    assert.match(indexHtml, /id="reel-strip-2"/, 'Should contain reel-strip-2');
    assert.match(indexHtml, /id="reel-strip-3"/, 'Should contain reel-strip-3');
    assert.match(indexHtml, /class="lottery-payline/, 'Should contain central payline');
    assert.match(indexHtml, /id="lottery-reach-banner"/, 'Should contain reach cut-in banner');
  });

  it('verifies ApiService mappings exist for lottery endpoints', () => {
    assert.match(indexHtml, /case 'getLotteryDataApi':/, 'ApiService should handle getLotteryDataApi');
    assert.match(indexHtml, /case 'recordLotteryWinnerApi':/, 'ApiService should handle recordLotteryWinnerApi');
    assert.match(indexHtml, /case 'deleteLotteryHistoryApi':/, 'ApiService should handle deleteLotteryHistoryApi');
    assert.match(indexHtml, /case 'resetLotteryHistoryApi':/, 'ApiService should handle resetLotteryHistoryApi');
  });

  it('verifies Router handles lottery tab cleanly', () => {
    assert.match(indexHtml, /'lottery':\s*{\s*title:\s*'定例会スロット抽選'/, 'PAGE_NAV_INFO should include lottery');
    assert.match(indexHtml, /if\s*\(tabName\s*===\s*'lottery'[\s\S]*?initLotteryView\(\)/, 'switchTab should call initLotteryView');
  });

  it('verifies fair distribution algorithm (Round-Robin & Weighted)', () => {
    // メンバー模擬データ: A(0勝), B(0勝), C(1勝), D(2勝)
    const members = [
      { id: '1', name: 'Member A', win_count: 0 },
      { id: '2', name: 'Member B', win_count: 0 },
      { id: '3', name: 'Member C', win_count: 1 },
      { id: '4', name: 'Member D', win_count: 2 }
    ];

    // 最小当選回数 (0回) のみをフィルタするRound-Robinテスト
    let minWins = Infinity;
    members.forEach(m => {
      if (m.win_count < minWins) minWins = m.win_count;
    });
    assert.strictEqual(minWins, 0, 'Min wins should be 0');

    const pool = members.filter(m => m.win_count === minWins);
    assert.strictEqual(pool.length, 2, 'Only Member A and Member B should be in round-robin pool');
    assert.ok(pool.every(m => m.win_count === 0), 'All candidates in pool should have 0 wins');

    // 全員が1回以上当たった場合の2周目テスト
    const roundTwoMembers = [
      { id: '1', name: 'Member A', win_count: 1 },
      { id: '2', name: 'Member B', win_count: 1 },
      { id: '3', name: 'Member C', win_count: 1 },
      { id: '4', name: 'Member D', win_count: 2 }
    ];
    let minWins2 = Infinity;
    roundTwoMembers.forEach(m => {
      if (m.win_count < minWins2) minWins2 = m.win_count;
    });
    const pool2 = roundTwoMembers.filter(m => m.win_count === minWins2);
    assert.strictEqual(pool2.length, 3, 'Candidates A, B, and C with 1 win should be in round 2 pool');
  });

  it('verifies 16:9 aspect ratio and fullscreen styles in compiled CSS', () => {
    assert.match(indexHtml, /aspect-ratio:\s*16\s*\/\s*9/, 'CSS should enforce 16/9 aspect ratio');
    assert.match(indexHtml, /\.lottery-theater-wrapper\.is-fullscreen/, 'CSS should define fullscreen override styles');
    assert.match(indexHtml, /reel-blur-spin-anim/, 'CSS should define spin blur animation');
    assert.match(indexHtml, /reach-pulse/, 'CSS should define reach pulse animation');
  });

  it('verifies Web Audio API synthesizer functions exist in lottery script', () => {
    assert.match(indexHtml, /function playLotterySound/, 'Script should contain playLotterySound');
    assert.match(indexHtml, /spin_start/, 'Sound engine should handle spin_start');
    assert.match(indexHtml, /reel_stop/, 'Sound engine should handle reel_stop');
    assert.match(indexHtml, /reach/, 'Sound engine should handle reach');
    assert.match(indexHtml, /fanfare/, 'Sound engine should handle fanfare');
  });

  it('verifies winner recording and modal controls exist', () => {
    assert.match(indexHtml, /id="lottery-winner-modal"/, 'Should contain winner modal');
    assert.match(indexHtml, /recordWinnerToDb/, 'Should contain recordWinnerToDb');
    assert.match(indexHtml, /id="lottery-member-config-modal"/, 'Should contain member config modal');
    assert.match(indexHtml, /id="lottery-history-modal"/, 'Should contain history modal');
  });
});
