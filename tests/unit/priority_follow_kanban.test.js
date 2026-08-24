const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Priority Follow Kanban Feature Unit Tests', () => {
  const viewPriorityFollowHtml = fs.readFileSync(path.join(__dirname, '../../src/ViewPriorityFollow.html'), 'utf8');
  const scriptPfHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/ViewPriorityFollow.html'), 'utf8');

  // ステージング分類テストロジック（クライアント側実装の仕様検証: 3ステージ）
  function categorizeVisitorToStage(v) {
    const isJoined = v.isJoined || '未';

    if (isJoined === 'メンバーシップ審査' || isJoined === '審査') {
      return 'stage-review'; // ③ 審査
    }
    if (isJoined === '入金待ち') {
      return 'stage-payment'; // ② 入金待ち
    }
    if (isJoined === '申込書提出' || isJoined === '申込') {
      return 'stage-applying'; // ① 申込提出
    }
    return null; // カンバン対象外（未・検討中等）
  }

  it('correctly categorizes visitors into 3 Kanban stages', () => {
    // 1. 申込提出: 申込書提出 / 申込
    const visitor1 = { id: '1', name: '鈴木', feelAbc: 'A', isJoined: '申込書提出', pendingActionCount: 1, overdueActionCount: 0 };
    assert.strictEqual(categorizeVisitorToStage(visitor1), 'stage-applying');

    // 2. 入金待ち: 入金待ち
    const visitor2 = { id: '2', name: '高橋', feelAbc: 'A', isJoined: '入金待ち', pendingActionCount: 0, overdueActionCount: 0 };
    assert.strictEqual(categorizeVisitorToStage(visitor2), 'stage-payment');

    // 3. 審査: メンバーシップ審査 / 審査
    const visitor3 = { id: '3', name: '伊藤', feelAbc: 'A', isJoined: 'メンバーシップ審査', pendingActionCount: 0, overdueActionCount: 0 };
    assert.strictEqual(categorizeVisitorToStage(visitor3), 'stage-review');

    const visitor4 = { id: '4', name: '渡辺', feelAbc: 'A', isJoined: '審査', pendingActionCount: 0, overdueActionCount: 0 };
    assert.strictEqual(categorizeVisitorToStage(visitor4), 'stage-review');

    // 対象外
    const visitor5 = { id: '5', name: '山田', feelAbc: 'A', isJoined: '未', pendingActionCount: 0, overdueActionCount: 0 };
    assert.strictEqual(categorizeVisitorToStage(visitor5), null);
  });

  it('sorts overdue visitors to the top of stage', () => {
    const items = [
      { id: '1', name: '通常A', pendingActionCount: 1, overdueActionCount: 0, eventDate: '2026-08-20' },
      { id: '2', name: '超過B', pendingActionCount: 1, overdueActionCount: 1, eventDate: '2026-08-10' },
      { id: '3', name: '通常C', pendingActionCount: 1, overdueActionCount: 0, eventDate: '2026-08-22' }
    ];

    const sorted = [...items].sort((a, b) => {
      const oA = Number(a.overdueActionCount) || 0;
      const oB = Number(b.overdueActionCount) || 0;
      if (oA !== oB) return oB - oA; // 超過が先頭
      return (b.eventDate || '').localeCompare(a.eventDate || '');
    });

    assert.strictEqual(sorted[0].id, '2', 'Overdue item must be sorted to top');
    assert.strictEqual(sorted[1].id, '3', 'Newer date must come before older date');
  });

  it('contains 3-column Kanban board HTML elements in ViewPriorityFollow.html', () => {
    assert.ok(viewPriorityFollowHtml.includes('pf-kanban-board'), 'Should define pf-kanban-board');
    assert.ok(viewPriorityFollowHtml.includes('pf-kanban-col-applying'), 'Should define applying stage col');
    assert.ok(viewPriorityFollowHtml.includes('pf-kanban-col-payment'), 'Should define payment stage col');
    assert.ok(viewPriorityFollowHtml.includes('pf-kanban-col-review'), 'Should define review stage col');
    assert.ok(viewPriorityFollowHtml.includes('pf-mobile-stage-tabs'), 'Should define mobile stage tabs container');
  });

  it('contains Kanban rendering and mobile switch functions in ViewPriorityFollow script', () => {
    assert.ok(scriptPfHtml.includes('renderPriorityFollowKanban'), 'Should implement renderPriorityFollowKanban');
    assert.ok(scriptPfHtml.includes('setPriorityFollowMobileStage'), 'Should implement setPriorityFollowMobileStage');
    assert.ok(scriptPfHtml.includes('togglePfViewMode'), 'Should implement togglePfViewMode');
  });
});
