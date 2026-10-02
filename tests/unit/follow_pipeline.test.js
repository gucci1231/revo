const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('☕ 4-Step Visitor Follow Pipeline Feature Tests', () => {
  // 1. Load Utils.html in a sandbox
  const utilsFile = path.join(__dirname, '../../src/scripts/Utils.html');
  const utilsCode = fs.readFileSync(utilsFile, 'utf8')
    .replace(/<script>/gi, '')
    .replace(/<\/script>/gi, '');

  const utilsSandbox = {
    window: {},
    document: {
      getElementById: () => null,
      querySelectorAll: () => []
    },
    navigator: { clipboard: { writeText: async () => {} } },
    showToast: () => {},
    alert: () => {},
    prompt: () => {},
    escapeHtml: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    formatShortDate: d => d,
    formatEventDateWithElapsed: d => d,
    renderAttendButtonHtml: () => '',
    renderJoinedButtonHtml: () => '',
    renderFollowTypeButtonHtml: () => '',
    renderRepeatBadgeHtml: () => '',
    renderRankBadgeHtml: () => '',
    resolveMemberName: s => s,
    formatTruncatedCell: s => s
  };
  utilsSandbox.window = utilsSandbox;

  vm.createContext(utilsSandbox);
  vm.runInContext(utilsCode, utilsSandbox);

  // 2. Load compiled index.html
  const compiledIndexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  // 3. Load Database.php
  const databasePhp = fs.readFileSync(path.join(__dirname, '../../api/Core/Database.php'), 'utf8');

  it('correctly calculates 4-step follow status for a brand new visitor', () => {
    const v = {
      id: '101',
      name: 'テストビジター',
      eventDate: '2026-10-16',
      isAttended: '未',
      isJoined: '未',
      step1Coffee: '未',
      step2Meeting: '未',
      step3Closing: '未',
      step4Join: '未'
    };

    const steps = utilsSandbox.getVisitorFollowSteps(v);
    assert.ok(steps, 'steps should not be null');
    assert.strictEqual(steps.s1.status, '未');
    assert.strictEqual(steps.s2.status, '予定'); // 未来の定例会参加予定
    assert.strictEqual(steps.s3.status, '未');
    assert.strictEqual(steps.s4.status, '未');
    assert.strictEqual(steps.completedSteps, 0);
    assert.strictEqual(steps.currentStepNum, 1, 'Should guide to Step 1: Coffee Meeting');
  });

  it('correctly detects scheduled and completed coffee meetings via action plans or explicit status', () => {
    // Scheduled via next action
    const vScheduled = {
      id: '102',
      name: '予約ビジター',
      eventDate: '2026-10-16',
      nextActionText: '事前コーヒーミーティング (平日12:00-12:30)',
      nextActionDueDate: '2026-10-14'
    };
    const stepsSched = utilsSandbox.getVisitorFollowSteps(vScheduled);
    assert.strictEqual(stepsSched.s1.status, '予定');
    assert.strictEqual(stepsSched.s1.date, '2026-10-14');

    // Completed via explicit step1Coffee
    const vCompleted = {
      id: '103',
      name: '完了ビジター',
      eventDate: '2026-10-16',
      step1Coffee: '済',
      step1CoffeeDate: '2026-10-13',
      isAttended: '未'
    };
    const stepsComp = utilsSandbox.getVisitorFollowSteps(vCompleted);
    assert.strictEqual(stepsComp.s1.status, '済');
    assert.strictEqual(stepsComp.completedSteps, 1);
    assert.strictEqual(stepsComp.currentStepNum, 2, 'Should advance to Step 2: Chapter Meeting');
  });

  it('correctly detects meeting attendance, follow/closing, and membership progression', () => {
    const vAttended = {
      id: '104',
      name: '来訪済ビジター',
      eventDate: '2026-10-09',
      step1Coffee: '済',
      isAttended: '参加',
      step3Closing: '未',
      isJoined: '未'
    };
    const stepsAtt = utilsSandbox.getVisitorFollowSteps(vAttended);
    assert.strictEqual(stepsAtt.s1.status, '済');
    assert.strictEqual(stepsAtt.s2.status, '済');
    assert.strictEqual(stepsAtt.completedSteps, 2);
    assert.strictEqual(stepsAtt.currentStepNum, 3, 'Should guide to Step 3: Meal/Closing');

    // After closing
    const vClosed = {
      id: '105',
      name: 'クロージング済ビジター',
      eventDate: '2026-10-09',
      step1Coffee: '済',
      isAttended: '参加',
      step3Closing: '済',
      isJoined: '申込書提出'
    };
    const stepsClosed = utilsSandbox.getVisitorFollowSteps(vClosed);
    assert.strictEqual(stepsClosed.s3.status, '済');
    assert.strictEqual(stepsClosed.s4.status, '進行中');
    assert.strictEqual(stepsClosed.currentStepNum, 4, 'Should guide to Step 4: Membership processing');

    // Fully joined
    const vJoined = {
      id: '106',
      name: '入会メンバー',
      eventDate: '2026-10-02',
      step1Coffee: '済',
      isAttended: '参加',
      step3Closing: '済',
      isJoined: '入会済'
    };
    const stepsJoined = utilsSandbox.getVisitorFollowSteps(vJoined);
    assert.strictEqual(stepsJoined.completedSteps, 4);
    assert.strictEqual(stepsJoined.currentStepNum, 5, 'Should be 5 (Goal achieved)');
  });

  it('generates coffee meeting invitation message containing weekday 12:00-12:30 details', () => {
    const v = {
      id: '201',
      name: '山田 太郎',
      inviter: '川口 陽平',
      eventDate: '2026-10-23'
    };

    const text = utilsSandbox.generateCoffeeMeetingInvitationText(v);
    assert.ok(text.includes('山田 太郎 様'), 'Should address visitor name');
    assert.ok(text.includes('12:00〜12:30') || text.includes('12:00-12:30'), 'Should mention 12:00-12:30');
    assert.ok(text.includes('事前コーヒーミーティング'), 'Should mention coffee meeting');
    assert.ok(text.includes('Zoom'), 'Should mention Zoom meeting');
    assert.ok(text.includes('川口 陽平'), 'Should mention inviter');
  });

  it('renders follow steps indicator HTML with proper status pills', () => {
    const v = {
      id: '301',
      name: 'テストビジター',
      step1Coffee: '済',
      isAttended: '参加',
      step3Closing: '未',
      isJoined: '未'
    };

    const html = utilsSandbox.renderFollowStepsIndicatorHtml(v);
    assert.ok(html.includes('follow-steps-row'), 'Should contain follow-steps-row');
    assert.ok(html.includes('step-completed'), 'Should contain step-completed');
    assert.ok(html.includes('fa-mug-hot'), 'Should contain mug icon');
    assert.ok(html.includes('fa-landmark'), 'Should contain landmark icon');
    assert.ok(html.includes('fa-utensils'), 'Should contain utensils icon');
    assert.ok(html.includes('fa-award'), 'Should contain award icon');
  });

  it('verifies 4-step follow pipeline UI elements exist in compiled index.html', () => {
    assert.ok(compiledIndexHtml.includes('vd-follow-pipeline-card'), 'index.html should have vd-follow-pipeline-card');
    assert.ok(compiledIndexHtml.includes('vd-step-node-1'), 'index.html should have vd-step-node-1');
    assert.ok(compiledIndexHtml.includes('vd-step-node-2'), 'index.html should have vd-step-node-2');
    assert.ok(compiledIndexHtml.includes('vd-step-node-3'), 'index.html should have vd-step-node-3');
    assert.ok(compiledIndexHtml.includes('vd-step-node-4'), 'index.html should have vd-step-node-4');
    assert.ok(compiledIndexHtml.includes('vd-next-guidance-box'), 'index.html should have vd-next-guidance-box');
    assert.ok(compiledIndexHtml.includes('data-type="コーヒーミーティング"'), 'index.html should have coffee meeting action pill');
    assert.ok(compiledIndexHtml.includes('data-type="食事会・対面クロージング"'), 'index.html should have closing action pill');
    assert.ok(compiledIndexHtml.includes('フォロー体制'), 'index.html should have フォロー体制 column header in table');
  });

  it('verifies SQLite visitors_status schema and ALTER TABLE migrations contain step columns', () => {
    assert.ok(databasePhp.includes('step1_coffee TEXT DEFAULT'), 'Database.php should define step1_coffee');
    assert.ok(databasePhp.includes('step1_coffee_date TEXT DEFAULT'), 'Database.php should define step1_coffee_date');
    assert.ok(databasePhp.includes('step2_meeting TEXT DEFAULT'), 'Database.php should define step2_meeting');
    assert.ok(databasePhp.includes('step3_closing TEXT DEFAULT'), 'Database.php should define step3_closing');
    assert.ok(databasePhp.includes('step4_join TEXT DEFAULT'), 'Database.php should define step4_join');
    assert.ok(databasePhp.includes('ALTER TABLE visitors_status ADD COLUMN step1_coffee'), 'Database.php should have migration for step1_coffee');
  });
});
