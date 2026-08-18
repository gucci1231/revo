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

      const isJoinedBool = (val) => (val === '入会済' || val === '済' || val === '入会' || val === true);
      const mergedJoined = (isJoinedBool(existing.isJoined) || isJoinedBool(r.isJoined)) ? '入会済' : (r.isJoined || existing.isJoined);
      const merged1to1 = (existing.is1to1 === '済' || r.is1to1 === '済') ? '済' : (r.is1to1 || existing.is1to1);
      const mergedHasHearing = existing.hasHearingSheet || r.hasHearingSheet;

      const mergedQ1 = r.q1 || existing.q1 || '';
      const mergedQ2 = r.q2 || existing.q2 || '';
      const mergedQ3 = r.q3 || existing.q3 || '';
      const mergedQ4 = r.q4 || existing.q4 || '';
      const mergedQ5 = r.q5 || existing.q5 || '';
      const mergedQ6 = r.q6 || existing.q6 || '';
      const mergedQ7 = r.q7 || existing.q7 || '';
      const mergedOrientUser = r.orientUser || existing.orientUser || '';
      const mergedOrientMemo = r.orientMemo || existing.orientMemo || '';
      const mergedFollowMemo = r.followMemo || existing.followMemo || '';
      const mergedFeelAbc = r.feelAbc || existing.feelAbc || '';
      const mergedSheetUrl = r.hearingUrl || r.sheetUrl || existing.hearingUrl || existing.sheetUrl || '';

      if (tNew >= tExisting) {
        Object.assign(existing, r, {
          historyCount: existing.historyCount,
          isAttended: r.isAttended || '未',
          isJoined: mergedJoined,
          is1to1: merged1to1,
          hasHearingSheet: mergedHasHearing,
          q1: mergedQ1,
          q2: mergedQ2,
          q3: mergedQ3,
          q4: mergedQ4,
          q5: mergedQ5,
          q6: mergedQ6,
          q7: mergedQ7,
          orientUser: mergedOrientUser,
          orientMemo: mergedOrientMemo,
          followMemo: mergedFollowMemo,
          feelAbc: mergedFeelAbc,
          hearingUrl: mergedSheetUrl,
          sheetUrl: mergedSheetUrl
        });
      } else {
        existing.isJoined = mergedJoined;
        existing.is1to1 = merged1to1;
        existing.hasHearingSheet = mergedHasHearing;
        existing.q1 = mergedQ1;
        existing.q2 = mergedQ2;
        existing.q3 = mergedQ3;
        existing.q4 = mergedQ4;
        existing.q5 = mergedQ5;
        existing.q6 = mergedQ6;
        existing.q7 = mergedQ7;
        existing.orientUser = mergedOrientUser;
        existing.orientMemo = mergedOrientMemo;
        existing.followMemo = mergedFollowMemo;
        existing.feelAbc = mergedFeelAbc;
        existing.hearingUrl = mergedSheetUrl;
        existing.sheetUrl = mergedSheetUrl;
      }
    }
  });

  return result;
}

describe('Visitor Deduplication & Name Variation Normalization', () => {
  it('deduplicates same name with full-width / half-width spaces', () => {
    const list = [
      { id: '1', name: '田中 太郎', email: 'tanaka@example.com' },
      { id: '2', name: '田中　太郎', email: 'tanaka@example.com' },
      { id: '3', name: '田中太郎', email: 'tanaka@example.com' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].historyCount, 3);
    assert.strictEqual(deduplicated[0].id, '3');
  });

  it('deduplicates Hiragana vs Katakana vs Half-width Katakana variations', () => {
    const list = [
      { id: '1', name: '山田 花子', furigana: 'ヤマダ ハナコ', email: 'yamada@example.com' },
      { id: '2', name: '山田 花子', furigana: 'やまだ はなこ', email: 'yamada@example.com' },
      { id: '3', name: '山田 花子', furigana: 'ﾔﾏﾀﾞ ﾊﾅｺ', email: 'yamada@example.com' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].historyCount, 3);
    assert.strictEqual(deduplicated[0].id, '3');
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

  it('sets isAttended to latest record status (allows new 2nd visit to start as 不参加/未) while preserving isJoined and is1to1', () => {
    const list = [
      { id: '1', name: '佐藤 花子', eventDate: '2026/04/01', isAttended: '参加', isJoined: '未', is1to1: '未' },
      { id: '2', name: '佐藤花子', eventDate: '2026/05/01', isAttended: '不参加', isJoined: '済', is1to1: '済' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].isAttended, '不参加');
    assert.strictEqual(deduplicated[0].isJoined, '入会済');
    assert.strictEqual(deduplicated[0].is1to1, '済');
  });

  it('preserves hearing sheet fields when newer event has empty hearing sheet', () => {
    const list = [
      { id: '1', name: '鈴木 一郎', eventDate: '2026/04/01', feelAbc: 'A', q1: 'とても良かった', orientUser: '田中' },
      { id: '2', name: '鈴木 一郎', eventDate: '2026/05/01', feelAbc: '', q1: '', orientUser: '' }
    ];
    const deduplicated = deduplicateVisitorListClient(list);
    assert.strictEqual(deduplicated.length, 1);
    assert.strictEqual(deduplicated[0].feelAbc, 'A');
    assert.strictEqual(deduplicated[0].q1, 'とても良かった');
    assert.strictEqual(deduplicated[0].orientUser, '田中');
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
