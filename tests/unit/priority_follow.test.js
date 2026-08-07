const assert = require('assert');

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
      { id: '3', name: 'Visitor C', feelAbc: 'C', isJoined: '未' }
    ];

    const deduplicated = deduplicateVisitorListClient(rawList);

    const filterByGrade = (list, gradeFilter) => {
      return list.filter(item => {
        const isJoined = (item.isJoined === '入会済' || item.isJoined === '済' || item.isJoined === '入会' || item.isJoined === true);
        if (isJoined) return false;
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
