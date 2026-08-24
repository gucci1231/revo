const assert = require('assert');

// メンバー名解決ユーティリティのテスト
const REVO_TEST_MEMBERS = [
  { id: '1', name: '小瀬戸 健一', category: '〇士業・事業サポート', profession: '融資・補助金申請サポート' },
  { id: '2', name: '前井 宏之', category: '〇士業・事業サポート', profession: '社長の孤独をなくす専属AI' },
  { id: '3', name: '平田 貴嗣', category: '〇建築', profession: '電気工事LED' },
  { id: '4', name: '上田 優也', category: '〇建築', profession: 'シーリング工事' },
  { id: '5', name: '阿部 真二', category: '〇不動産', profession: '不動産買取り' },
  { id: '6', name: '三島 文美', category: '〇保険・金融', profession: '生命保険' },
  { id: '7', name: '永井 創太', category: '〇保険・金融', profession: '生命保険（個人）' },
  { id: '8', name: '森田 由美子', category: '〇飲食・物販', profession: '日本茶販売' },
  { id: '9', name: '川田 湧矢', category: '〇飲食・物販', profession: '和食とワイン' },
  { id: '10', name: '鈴木 太郎', category: '〇その他', profession: 'コンサル' },
  { id: '11', name: '鈴木 次郎', category: '〇その他', profession: 'デザイナー' }
];

function findMemberByName(rawName, membersList = null) {
  if (!rawName) return null;
  const members = (membersList && Array.isArray(membersList) && membersList.length > 0) ? membersList : [];
  if (!members || members.length === 0) return null;

  let cleaned = String(rawName).trim();
  cleaned = cleaned.replace(/[\s\u3000]*(?:さん|様|さま|氏|君|くん|先生|社長|代表)$/u, '').trim();
  if (!cleaned) return null;

  const cleanKey = cleaned.replace(/[\s\u3000]+/g, '').toLowerCase();

  // 1. 完全一致 (スペース無視)
  for (const m of members) {
    const mName = (m.name || '').trim();
    const mKey = mName.replace(/[\s\u3000]+/g, '').toLowerCase();
    if (cleanKey === mKey) return m;
  }

  // 2. 姓一致 (苗字一致)
  const lastNameMatches = [];
  for (const m of members) {
    const mName = (m.name || '').trim();
    const parts = mName.split(/[\s\u3000]+/);
    const lastName = (parts[0] || '').toLowerCase();
    if (lastName && cleanKey === lastName) {
      lastNameMatches.push(m);
    }
  }
  if (lastNameMatches.length === 1) {
    return lastNameMatches[0];
  }

  // 3. 名一致 (名前一致)
  const firstNameMatches = [];
  for (const m of members) {
    const mName = (m.name || '').trim();
    const parts = mName.split(/[\s\u3000]+/);
    if (parts.length > 1) {
      const firstName = parts.slice(1).join('').toLowerCase();
      if (firstName && cleanKey === firstName) {
        firstNameMatches.push(m);
      }
    }
  }
  if (firstNameMatches.length === 1) {
    return firstNameMatches[0];
  }

  // 4. 部分一致 / 前方一致
  const partialMatches = [];
  for (const m of members) {
    const mName = (m.name || '').trim();
    const mKey = mName.replace(/[\s\u3000]+/g, '').toLowerCase();
    if (mKey.includes(cleanKey) || cleanKey.includes(mKey)) {
      partialMatches.push(m);
    }
  }
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return null;
}

function resolveMemberName(rawName, membersList = null) {
  if (!rawName) return '';
  const rawStr = String(rawName).trim();
  if (!rawStr || rawStr === '-') return rawStr;

  const found = findMemberByName(rawStr, membersList);
  if (found && found.name) {
    return found.name;
  }

  return rawStr.replace(/[\s\u3000]*(?:さん|様|さま|氏|君|くん|先生|社長|代表)$/u, '').trim() || rawStr;
}

describe('Member Name Resolution & Normalization Tests', () => {
  it('correctly resolves single last name to full member name (森田 -> 森田 由美子)', () => {
    assert.strictEqual(resolveMemberName('森田', REVO_TEST_MEMBERS), '森田 由美子');
  });

  it('correctly resolves honorific variations (森田さん, 森田様, 森田さま -> 森田 由美子)', () => {
    assert.strictEqual(resolveMemberName('森田さん', REVO_TEST_MEMBERS), '森田 由美子');
    assert.strictEqual(resolveMemberName('森田様', REVO_TEST_MEMBERS), '森田 由美子');
    assert.strictEqual(resolveMemberName('森田さま', REVO_TEST_MEMBERS), '森田 由美子');
    assert.strictEqual(resolveMemberName('森田　さん', REVO_TEST_MEMBERS), '森田 由美子');
  });

  it('correctly resolves full name without space (森田由美子 -> 森田 由美子)', () => {
    assert.strictEqual(resolveMemberName('森田由美子', REVO_TEST_MEMBERS), '森田 由美子');
    assert.strictEqual(resolveMemberName('森田由美子さん', REVO_TEST_MEMBERS), '森田 由美子');
    assert.strictEqual(resolveMemberName('森田　由美子様', REVO_TEST_MEMBERS), '森田 由美子');
  });

  it('correctly resolves other members (阿部, 前井, 平田)', () => {
    assert.strictEqual(resolveMemberName('阿部', REVO_TEST_MEMBERS), '阿部 真二');
    assert.strictEqual(resolveMemberName('前井さん', REVO_TEST_MEMBERS), '前井 宏之');
    assert.strictEqual(resolveMemberName('平田貴嗣', REVO_TEST_MEMBERS), '平田 貴嗣');
  });

  it('handles ambiguous duplicated last names safely (鈴木 -> does not wrongly force single one if ambiguous)', () => {
    assert.strictEqual(resolveMemberName('鈴木', REVO_TEST_MEMBERS), '鈴木');
    assert.strictEqual(resolveMemberName('鈴木さん', REVO_TEST_MEMBERS), '鈴木');
    assert.strictEqual(resolveMemberName('鈴木太郎', REVO_TEST_MEMBERS), '鈴木 太郎');
    assert.strictEqual(resolveMemberName('鈴木 次郎 様', REVO_TEST_MEMBERS), '鈴木 次郎');
  });

  it('preserves non-member external inviters cleanly without honorifics (外部ゲストさん -> 外部ゲスト)', () => {
    assert.strictEqual(resolveMemberName('佐藤 健太さん', REVO_TEST_MEMBERS), '佐藤 健太');
    assert.strictEqual(resolveMemberName('テスト外部紹介者', REVO_TEST_MEMBERS), 'テスト外部紹介者');
    assert.strictEqual(resolveMemberName('-', REVO_TEST_MEMBERS), '-');
    assert.strictEqual(resolveMemberName('', REVO_TEST_MEMBERS), '');
    assert.strictEqual(resolveMemberName(null, REVO_TEST_MEMBERS), '');
  });

  it('findMemberByName returns full member details when found', () => {
    const m = findMemberByName('森田さん', REVO_TEST_MEMBERS);
    assert.ok(m);
    assert.strictEqual(m.name, '森田 由美子');
    assert.strictEqual(m.profession, '日本茶販売');
    assert.strictEqual(m.category, '〇飲食・物販');
  });
});
