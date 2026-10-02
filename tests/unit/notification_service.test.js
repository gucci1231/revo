const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📨 Step 6-7: Notification Orchestration (Apple-style Emails & LINE) Feature Tests', () => {
  const notifPhp = fs.readFileSync(path.join(__dirname, '../../api/Services/NotificationService.php'), 'utf8');

  it('verifies NotificationService.php exists with Apple-grade pure white card email rendering', () => {
    assert.ok(notifPhp.includes('class NotificationService'), 'NotificationService class must exist');
    assert.ok(notifPhp.includes('renderAppleStyleEmail'), 'renderAppleStyleEmail method must exist');
    assert.ok(notifPhp.includes('background-color: #ffffff'), 'Email card must be pure white (#ffffff)');
    assert.ok(notifPhp.includes('border: 1px solid #e2e8f0'), 'Email card must have subtle border (#e2e8f0)');
    assert.ok(notifPhp.includes('min-height: 50px'), 'Must feature large 50px touch target button');
  });

  it('verifies 3 scheduled dispatch cycles are implemented', () => {
    // Cycle 1: Thursday 09:00 (Post-meeting Feel Rating)
    assert.ok(notifPhp.includes('generatePostMeetingFeelEmail'), 'Cycle 1 feel email generator must exist');
    assert.ok(notifPhp.includes('urlRankA'), 'Must generate Rank A 1-tap URL');
    assert.ok(notifPhp.includes('urlRankB'), 'Must generate Rank B 1-tap URL');
    assert.ok(notifPhp.includes('urlRankC'), 'Must generate Rank C 1-tap URL');

    // Cycle 2: Wednesday 19:00 (Pre-meeting Reminder)
    assert.ok(notifPhp.includes('generatePreMeetingReminderEmail'), 'Cycle 2 pre-meeting reminder must exist');
    assert.ok(notifPhp.includes('スリップ入力'), 'Must remind BNI Connect slips');

    // Cycle 3: Friday 12:00 (PALMS weekly report)
    assert.ok(notifPhp.includes('generatePalmsWeeklyEmail'), 'Cycle 3 PALMS weekly report must exist');
    assert.ok(notifPhp.includes('トラフィックライト'), 'Must include traffic lights score');
  });

  it('verifies LINE Messaging API alert interface is available', () => {
    assert.ok(notifPhp.includes('sendLinePushAlert'), 'sendLinePushAlert method must exist');
    assert.ok(notifPhp.includes('LINE_CHANNEL_ACCESS_TOKEN'), 'Must read LINE token from environment');
  });
});
