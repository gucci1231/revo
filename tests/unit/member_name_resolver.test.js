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
  { id: '10', name: '板谷 栄子', category: '〇美容・健康', profession: 'ながらダイエット機器販売' },
  { id: '11', name: '桐原 卓也', category: '〇クリエイティブ・マーケティング', profession: 'SNS特化ショート動画制作' },
  { id: '12', name: '川口 陽平', category: '〇クリエイティブ・マーケティング', profession: 'デザイナー' },
  { id: '13', name: '江幡 幸典', category: '〇クリエイティブ・マーケティング', profession: '人生の節目フォトグラファー' },
  { id: '14', name: '居原田 晃司', category: '〇ライフイベント・サービス', profession: '結婚相談所' },
  { id: '15', name: '熊野 りん', category: 'DNAメンバー', profession: 'DNA' },
  { id: '16', name: '畑中 実', category: 'DNAメンバー', profession: 'DNA' },
  { id: '17', name: '野本 暁', category: 'DNAメンバー', profession: 'DNA' },
  { id: '18', name: '佐内 勖', category: 'DNAメンバー', profession: 'DNA' },
  { id: '19', name: '松本 俊輔', category: 'DNAメンバー', profession: 'DNA' },
  { id: '20', name: '鈴木 太郎', category: '〇その他', profession: 'コンサル' },
  { id: '21', name: '鈴木 次郎', category: '〇その他', profession: 'デザイナー' }
];

const KNOWN_MEMBER_ALIASES = [
  { canonical: '小瀬戸 健一', aliases: ['小瀬戸', 'おぜと', 'おせど', '小瀬', '瀬戸', 'おぜとさん', 'おせどさん', 'こせど'] },
  { canonical: '前井 宏之', aliases: ['前井', 'まえい', '前居', '前居宏之', '前居さん'] },
  { canonical: '平田 貴嗣', aliases: ['平田', 'ひらた', '平田さん', '平田たかつぐ', 'たかつぐ'] },
  { canonical: '上田 優也', aliases: ['上田', 'うえだ', '植田', '上田さん', 'ゆうや'] },
  { canonical: '阿部 真二', aliases: ['阿部', 'あべ', '安倍', '安部', '阿部さん', '安倍さん', '真二', 'しんじ'] },
  { canonical: '三島 文美', aliases: ['三島', 'みしま', '三島さん', '文美', 'あやみ'] },
  { canonical: '永井 創太', aliases: ['永井', 'ながい', '長井', '長井さん', '永井さん', '創太', 'そうた'] },
  { canonical: '森田 由美子', aliases: ['森田', 'もりた', '盛田', '森田さん', '盛田さん', '由美子', 'ゆみこ'] },
  { canonical: '川田 湧矢', aliases: ['川田', 'かわた', 'かわだ', '河田', '川田さん', '湧矢'] },
  { canonical: '板谷 栄子', aliases: ['板谷', 'いたや', '板屋', '板谷さん', '板屋さん', '栄子', 'えいこ'] },
  { canonical: '桐原 卓也', aliases: ['桐原', 'きりはら', '桐山', '桐原さん', '卓也', 'たくや'] },
  { canonical: '川口 陽平', aliases: ['川口', 'かわぐち', '河口', '川口さん', '陽平', 'ようへい', 'ぐっち'] },
  { canonical: '江幡 幸典', aliases: ['江幡', '江端', 'えばた', 'えばたさん', '江端さん', '江端幸典', '江端ゆきのり', '幸典', 'ゆきのり', 'エバタ'] },
  { canonical: '居原田 晃司', aliases: ['居原田', 'いはらだ', '井原田', '猪原田', '居原田さん', '井原田さん', '晃司', 'こうじ'] },
  { canonical: '熊野 りん', aliases: ['熊野', 'くまの', '熊野さん', 'りん', 'りんさん'] },
  { canonical: '畑中 実', aliases: ['畑中', 'はたなか', '畑中さん', '実', 'みのる'] },
  { canonical: '野本 暁', aliases: ['野本', 'のもと', '野本さん', '暁', 'あきら'] },
  { canonical: '佐内 勖', aliases: ['佐内', 'さない', '佐内さん', '左内'] },
  { canonical: '松本 俊輔', aliases: ['松本', 'まつもと', '松本さん', '俊輔', 'しゅんすけ'] }
];

function toHiragana(str) {
  if (!str) return '';
  return str.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function getLevenshteinDistance(a, b) {
  if (!a || !b) return (a || b).length;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function findMemberByName(rawName, membersList = null) {
  if (!rawName) return null;
  const members = (membersList && Array.isArray(membersList) && membersList.length > 0) ? membersList : [];
  if (!members || members.length === 0) return null;

  let cleaned = String(rawName).trim();
  cleaned = cleaned.replace(/[\s\u3000]*(?:さん|様|さま|氏|君|くん|先生|社長|代表)$/u, '').trim();
  if (!cleaned) return null;

  const cleanKey = cleaned.replace(/[\s\u3000]+/g, '').toLowerCase();
  const cleanHiragana = toHiragana(cleanKey);

  // 1. 完全一致 (スペース無視)
  for (const m of members) {
    const mName = (m.name || '').trim();
    const mKey = mName.replace(/[\s\u3000]+/g, '').toLowerCase();
    if (cleanKey === mKey) return m;
  }

  // 2. 既知の同音・漢字エイリアス / ひらがな辞書一致
  for (const item of KNOWN_MEMBER_ALIASES) {
    for (const alias of item.aliases) {
      const aKey = alias.replace(/[\s\u3000]+/g, '').toLowerCase();
      const aHira = toHiragana(aKey);
      if (cleanKey === aKey || cleanHiragana === aHira) {
        const found = members.find(m => (m.name || '').trim() === item.canonical);
        if (found) return found;
      }
    }
  }

  // 3. 姓一致 (苗字一致)
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

  // 4. 名一致 (名前一致)
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

  // 5. 部分一致 / 前方一致
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

  // 6. 編集距離マッチング (1文字違いの漢字間違い・タイポ)
  if (cleanKey.length >= 2) {
    const typoMatches = [];
    for (const m of members) {
      const mName = (m.name || '').trim();
      const mKey = mName.replace(/[\s\u3000]+/g, '').toLowerCase();
      const parts = mName.split(/[\s\u3000]+/);
      const lastName = (parts[0] || '').toLowerCase();

      const distFull = getLevenshteinDistance(cleanKey, mKey);
      const distLast = getLevenshteinDistance(cleanKey, lastName);

      if (distFull <= 1 || (distLast <= 1 && cleanKey.length >= 2)) {
        typoMatches.push({ member: m, dist: Math.min(distFull, distLast) });
      }
    }

    if (typoMatches.length === 1) {
      return typoMatches[0].member;
    }
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

  it('correctly resolves Kanji typos and phonetic variants (江端, えばた -> 江幡 幸典)', () => {
    assert.strictEqual(resolveMemberName('江端', REVO_TEST_MEMBERS), '江幡 幸典');
    assert.strictEqual(resolveMemberName('江端さん', REVO_TEST_MEMBERS), '江幡 幸典');
    assert.strictEqual(resolveMemberName('江端幸典', REVO_TEST_MEMBERS), '江幡 幸典');
    assert.strictEqual(resolveMemberName('えばた', REVO_TEST_MEMBERS), '江幡 幸典');
    assert.strictEqual(resolveMemberName('えばたさん', REVO_TEST_MEMBERS), '江幡 幸典');
    assert.strictEqual(resolveMemberName('エバタ', REVO_TEST_MEMBERS), '江幡 幸典');
  });

  it('correctly resolves other member Kanji and Hiragana typos (井原田, いたや, ながい, 安倍)', () => {
    assert.strictEqual(resolveMemberName('井原田', REVO_TEST_MEMBERS), '居原田 晃司');
    assert.strictEqual(resolveMemberName('いはらだ', REVO_TEST_MEMBERS), '居原田 晃司');
    assert.strictEqual(resolveMemberName('板屋', REVO_TEST_MEMBERS), '板谷 栄子');
    assert.strictEqual(resolveMemberName('いたや', REVO_TEST_MEMBERS), '板谷 栄子');
    assert.strictEqual(resolveMemberName('長井', REVO_TEST_MEMBERS), '永井 創太');
    assert.strictEqual(resolveMemberName('ながい', REVO_TEST_MEMBERS), '永井 創太');
    assert.strictEqual(resolveMemberName('安倍', REVO_TEST_MEMBERS), '阿部 真二');
    assert.strictEqual(resolveMemberName('あべさん', REVO_TEST_MEMBERS), '阿部 真二');
    assert.strictEqual(resolveMemberName('おぜと', REVO_TEST_MEMBERS), '小瀬戸 健一');
    assert.strictEqual(resolveMemberName('ぐっち', REVO_TEST_MEMBERS), '川口 陽平');
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
    const m = findMemberByName('江端さん', REVO_TEST_MEMBERS);
    assert.ok(m);
    assert.strictEqual(m.name, '江幡 幸典');
    assert.strictEqual(m.profession, '人生の節目フォトグラファー');
    assert.strictEqual(m.category, '〇クリエイティブ・マーケティング');
  });
});
