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

describe('Priority Follow List Filtering TDD Unit Tests', () => {
  it('deduplicates before filtering so joined repeat visitors are properly marked as 入会済 and excluded from unjoined priority list', () => {
    const rawList = [
      { id: '85', name: '田中友規', feelAbc: 'A', isJoined: '未', eventDate: '2025/10/16' },
      { id: '92', name: '田中友規', feelAbc: 'A', isJoined: '入会済', eventDate: '2025/10/23' }
    ];

    // Correct order: Deduplicate first, then filter
    const deduplicated = deduplicateVisitorListClient(rawList);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].isJoined, '入会済');

    // Filter unjoined A/B evaluation visitors
    const priorityFollowList = deduplicated.filter(item => {
      const isJoined = (item.isJoined === '入会済' || item.isJoined === '済' || item.isJoined === '入会' || item.isJoined === true);
      return (item.feelAbc === 'A' || item.feelAbc === 'B') && !isJoined;
    });

    assert.strictEqual(priorityFollowList.length, 0); // Joined visitor must be excluded from unjoined follow-up list!
  });
});
