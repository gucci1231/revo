const assert = require('assert');

describe('Priority Follow Feature Unit Tests', () => {
// Import or copy deduplicateVisitorListClient for unit testing
function normalizeNameKey(str) {
  if (!str) return '';
  let s = String(str);
  s = s.normalize('NFKC');
  s = s.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  s = s.replace(/[・·\.\,\-\_]/g, '');
  s = s.replace(/[\s\u3000\t\r\n]+/g, '');
  return s.toLowerCase();
}

function deduplicateVisitorListClient(list) {
  if (!list || !Array.isArray(list) || list.length === 0) return [];

  const result = [];
  const nameMap = new Map();
  const furiganaMap = new Map();
  const emailMap = new Map();

  list.forEach(r => {
    const emailKey = r.email ? normalizeNameKey(r.email) : '';
    const rawName = r.name ? String(r.name).trim() : '';
    const isGenericName = !rawName || /^ビジター\s*(no\.?\s*\d+)?$/i.test(rawName);
    const nameKey = !isGenericName ? normalizeNameKey(rawName) : '';
    const furiganaKey = (r.furigana && !isGenericName) ? normalizeNameKey(r.furigana) : '';

    let existing = null;
    if (emailKey && emailMap.has(emailKey)) {
      existing = emailMap.get(emailKey);
    } else if (nameKey && nameMap.has(nameKey)) {
      existing = nameMap.get(nameKey);
    } else if (furiganaKey && furiganaMap.has(furiganaKey)) {
      existing = furiganaMap.get(furiganaKey);
    }

    if (!existing) {
      const entry = { ...r, historyCount: 1 };
      result.push(entry);

      if (emailKey) emailMap.set(emailKey, entry);
      if (nameKey) nameMap.set(nameKey, entry);
      if (furiganaKey) furiganaMap.set(furiganaKey, entry);
    } else {
      existing.historyCount = (existing.historyCount || 1) + 1;

      if (emailKey && !emailMap.has(emailKey)) emailMap.set(emailKey, existing);
      if (nameKey && !nameMap.has(nameKey)) nameMap.set(nameKey, existing);
      if (furiganaKey && !furiganaMap.has(furiganaKey)) furiganaMap.set(furiganaKey, existing);

      const isJoinedBool = (val) => (val === '入会済' || val === '済' || val === '入会' || val === true);
      const mergedAttended = (existing.isAttended === '参加' || r.isAttended === '参加') ? '参加' : (r.isAttended || existing.isAttended);
      const mergedJoined = (isJoinedBool(existing.isJoined) || isJoinedBool(r.isJoined)) ? '入会済' : (r.isJoined || existing.isJoined);
      const merged1to1 = (existing.is1to1 === '済' || r.is1to1 === '済') ? '済' : (r.is1to1 || existing.is1to1);
      const mergedHasHearing = existing.hasHearingSheet || r.hasHearingSheet;

      const mergedQ1 = r.q1 || existing.q1 || '';
      const mergedOrientUser = r.orientUser || existing.orientUser || '';
      const mergedFeelAbc = r.feelAbc || existing.feelAbc || '';

      Object.assign(existing, {
        isAttended: mergedAttended,
        isJoined: mergedJoined,
        is1to1: merged1to1,
        hasHearingSheet: mergedHasHearing,
        q1: mergedQ1,
        orientUser: mergedOrientUser,
        feelAbc: mergedFeelAbc
      });
    }
  });

  return result;
}

  it('filters priority follow list by grade (A only, B only, A+B all)', () => {
    const rawList = [
      { id: '1', name: 'Visitor A', feelAbc: 'A', isJoined: '未' },
      { id: '2', name: 'Visitor B', feelAbc: 'B', isJoined: '未' },
      { id: '3', name: 'Visitor C', feelAbc: 'C', isJoined: '未' },
      { id: '4', name: 'Visitor A Rejected', feelAbc: 'A', isJoined: '見送り' }
    ];

    const deduplicated = deduplicateVisitorListClient(rawList);

    const filterByGrade = (list, gradeFilter) => {
      return list.filter(item => {
        const isJoined = (item.isJoined === '入会済' || item.isJoined === '済' || item.isJoined === '入会' || item.isJoined === true);
        const isRejected = (item.isJoined === '見送り');
        if (isJoined || isRejected) return false;
        if (gradeFilter === 'A') return item.feelAbc === 'A';
        if (gradeFilter === 'B') return item.feelAbc === 'B';
        return item.feelAbc === 'A' || item.feelAbc === 'B';
      });
    };

    const allAB = filterByGrade(deduplicated, 'ALL');
    assert.strictEqual(allAB.length, 2);
    assert.deepStrictEqual(allAB.map(v => v.name), ['Visitor A', 'Visitor B']);

    const aOnly = filterByGrade(deduplicated, 'A');
    assert.strictEqual(aOnly.length, 1);
    assert.strictEqual(aOnly[0].name, 'Visitor A');

    const bOnly = filterByGrade(deduplicated, 'B');
    assert.strictEqual(bOnly.length, 1);
    assert.strictEqual(bOnly[0].name, 'Visitor B');
  });

  it('correctly filters and prioritizes stagnant, overdue, and active priority follow visitors', () => {
    const list = [
      { id: '1', name: 'Active Visitor', feelAbc: 'A', isJoined: '未', pendingActionCount: 1, overdueActionCount: 0, eventDate: '2026-08-20' },
      { id: '2', name: 'Overdue Visitor', feelAbc: 'A', isJoined: '未', pendingActionCount: 2, overdueActionCount: 1, eventDate: '2026-08-15' },
      { id: '3', name: 'Stagnant Visitor 1', feelAbc: 'B', isJoined: '未', pendingActionCount: 0, overdueActionCount: 0, eventDate: '2026-08-10' },
      { id: '4', name: 'Stagnant Visitor 2', feelAbc: 'A', isJoined: '未', pendingActionCount: 0, overdueActionCount: 0, eventDate: '2026-08-22' },
      { id: '5', name: 'Joined Visitor', feelAbc: 'A', isJoined: '入会済', pendingActionCount: 0, overdueActionCount: 0, eventDate: '2026-08-18' }
    ];

    // Filter base list (feel A or B, not joined, not rejected)
    const baseList = list.filter(v => v.isJoined !== '入会済' && v.isJoined !== '見送り' && (v.feelAbc === 'A' || v.feelAbc === 'B'));
    assert.strictEqual(baseList.length, 4);

    // Stagnant filter (pendingActionCount === 0)
    const stagnant = baseList.filter(v => (Number(v.pendingActionCount) || 0) === 0);
    assert.strictEqual(stagnant.length, 2);
    assert.deepStrictEqual(stagnant.map(v => v.name), ['Stagnant Visitor 1', 'Stagnant Visitor 2']);

    // Overdue filter (overdueActionCount > 0)
    const overdue = baseList.filter(v => (Number(v.overdueActionCount) || 0) > 0);
    assert.strictEqual(overdue.length, 1);
    assert.strictEqual(overdue[0].name, 'Overdue Visitor');

    // Active filter (pendingActionCount > 0 && overdueActionCount === 0)
    const active = baseList.filter(v => (Number(v.pendingActionCount) || 0) > 0 && (Number(v.overdueActionCount) || 0) === 0);
    assert.strictEqual(active.length, 1);
    assert.strictEqual(active[0].name, 'Active Visitor');

    // Sort order test: Overdue (1) -> Stagnant (2) -> Active (3), then eventDate DESC
    const sorted = [...baseList].sort((a, b) => {
      const getRank = (v) => {
        if ((Number(v.overdueActionCount) || 0) > 0) return 1;
        if ((Number(v.pendingActionCount) || 0) === 0) return 2;
        return 3;
      };
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (b.eventDate || '').localeCompare(a.eventDate || '');
    });

    assert.deepStrictEqual(sorted.map(v => v.name), [
      'Overdue Visitor',    // Rank 1: Overdue
      'Stagnant Visitor 2', // Rank 2: Stagnant (eventDate: 2026-08-22 newer)
      'Stagnant Visitor 1', // Rank 2: Stagnant (eventDate: 2026-08-10)
      'Active Visitor'      // Rank 3: Active
    ]);
  });
});
