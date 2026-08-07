const assert = require('assert');

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

      const tExisting = new Date(existing.eventDate || 0).getTime();
      const tNew = new Date(r.eventDate || 0).getTime();

      const mergedAttended = (existing.isAttended === '参加' || r.isAttended === '参加') ? '参加' : (r.isAttended || existing.isAttended);
      const mergedJoined = (existing.isJoined === '入会済' || r.isJoined === '入会済') ? '入会済' : (r.isJoined || existing.isJoined);
      const merged1to1 = (existing.is1to1 === '済' || r.is1to1 === '済') ? '済' : (r.is1to1 || existing.is1to1);
      const mergedHasHearing = existing.hasHearingSheet || r.hasHearingSheet;

      if (tNew >= tExisting) {
        Object.assign(existing, r, {
          historyCount: existing.historyCount,
          isAttended: mergedAttended,
          isJoined: mergedJoined,
          is1to1: merged1to1,
          hasHearingSheet: mergedHasHearing,
          q7: r.q7 || existing.q7,
          orientUser: r.orientUser || existing.orientUser,
          orientMemo: r.orientMemo || existing.orientMemo,
          feelAbc: r.feelAbc || existing.feelAbc
        });
      } else {
        existing.isAttended = mergedAttended;
        existing.isJoined = mergedJoined;
        existing.is1to1 = merged1to1;
        existing.hasHearingSheet = mergedHasHearing;
        if (!existing.q7 && r.q7) existing.q7 = r.q7;
        if (!existing.orientUser && r.orientUser) existing.orientUser = r.orientUser;
        if (!existing.orientMemo && r.orientMemo) existing.orientMemo = r.orientMemo;
        if (!existing.feelAbc && r.feelAbc) existing.feelAbc = r.feelAbc;
      }
    }
  });

  return result;
}

describe('Visitor Deduplication & Name Variation Normalization', () => {
  it('deduplicates same name with full-width / half-width spaces', () => {
    const list = [
      { id: '1', name: '山田　太郎', eventDate: '2026/04/01' },
      { id: '2', name: '山田 太郎', eventDate: '2026/04/08' },
      { id: '3', name: '山田太郎', eventDate: '2026/04/15' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].historyCount, 3);
    assert.strictEqual(deduplicated[0].id, '3');
  });

  it('deduplicates Hiragana vs Katakana vs Half-width Katakana variations', () => {
    const list = [
      { id: '1', name: 'ヤマダ タロウ', furigana: 'ヤマダ タロウ' },
      { id: '2', name: 'やまだ たろう', furigana: 'やまだ たろう' },
      { id: '3', name: 'ﾔﾏﾀﾞ ﾀﾛｳ', furigana: 'ﾔﾏﾀﾞ ﾀﾛｳ' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].historyCount, 3);
  });

  it('deduplicates names with middle dots or English case variations', () => {
    const list = [
      { id: '1', name: 'ジョン・スミス', email: 'john@example.com' },
      { id: '2', name: 'ジョン スミス', email: 'JOHN@EXAMPLE.COM' },
      { id: '3', name: 'John Smith', email: 'john@example.com' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].historyCount, 3);
  });

  it('merges status flags across multiple records for the same visitor', () => {
    const list = [
      { id: '1', name: '佐藤 花子', isAttended: '参加', isJoined: '未', is1to1: '未' },
      { id: '2', name: '佐藤花子', isAttended: '不参加', isJoined: '入会済', is1to1: '済' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].isAttended, '参加');
    assert.strictEqual(deduplicated[0].isJoined, '入会済');
    assert.strictEqual(deduplicated[0].is1to1, '済');
  });

  it('does NOT merge generic "ビジター No.X" placeholder entries', () => {
    const list = [
      { id: '1', name: 'ビジター No.1' },
      { id: '2', name: 'ビジター No.2' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 2);
  });
});
