const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📱 Step 6-3 & 6-4: Ultra-lightweight Mobile My Portal & Flashcards Feature Tests', () => {
  const myPhpPath = path.join(__dirname, '../../my.php');
  assert.ok(fs.existsSync(myPhpPath), 'my.php must exist in root directory');

  const myPhpContent = fs.readFileSync(myPhpPath, 'utf8');
  const stat = fs.statSync(myPhpPath);

  it('verifies my.php file size is under 30KB (Apple-grade ultra-lightweight MPA mandate)', () => {
    const sizeKb = stat.size / 1024;
    console.log(`    my.php size: ${sizeKb.toFixed(2)} KB (Target: < 30 KB)`);
    assert.ok(sizeKb < 30, `my.php must be under 30KB, actual: ${sizeKb.toFixed(2)} KB`);
  });

  it('verifies Zero-Login stateless token authentication integration', () => {
    assert.ok(myPhpContent.includes('TokenService::verifyToken'), 'Must use TokenService for zero-login authentication');
    assert.ok(myPhpContent.includes('$token'), 'Must read token from request parameters');
  });

  it('verifies Apple Watch style Triple Activity Rings (Visitor, Slips, 1to1)', () => {
    assert.ok(myPhpContent.includes('ring-visitor'), 'Visitor ring SVG element must exist');
    assert.ok(myPhpContent.includes('ring-slips'), 'Slips ring SVG element must exist');
    assert.ok(myPhpContent.includes('ring-1to1'), '1to1 ring SVG element must exist');
    assert.ok(myPhpContent.includes('stroke-dasharray'), 'SVG stroke-dasharray must be defined');
    assert.ok(myPhpContent.includes('stroke-dashoffset'), 'SVG stroke-dashoffset must be calculated');
  });

  it('verifies "Yes/No Pan-Pan-Pan" Flashcard Decision UI & Inbox Zero state', () => {
    assert.ok(myPhpContent.includes('deck-container'), 'Flashcard deck container must exist');
    assert.ok(myPhpContent.includes('class="flashcard"'), 'Flashcard item element must exist');
    assert.ok(myPhpContent.includes('handleCardAction'), 'handleCardAction JS handler must exist');
    assert.ok(myPhpContent.includes('inbox-zero'), 'Inbox Zero celebration screen must exist');
    assert.ok(myPhpContent.includes('streak-pill'), 'Streak gamification pill must exist');
  });

  it('verifies Communication Engine (High-Five & Rescue attendance request)', () => {
    assert.ok(myPhpContent.includes('sendHighFive'), 'sendHighFive function must exist');
    assert.ok(myPhpContent.includes('requestProxyAttendance'), 'requestProxyAttendance function must exist');
    assert.ok(myPhpContent.includes('copyToClipboard'), 'copyToClipboard helper must exist');
  });

  it('verifies introduced visitors section with feel rank pills', () => {
    assert.ok(myPhpContent.includes('myVisitors'), 'Must query introduced visitors');
    assert.ok(myPhpContent.includes('rank-pill'), 'Must render feel rank pill elements');
  });
});
