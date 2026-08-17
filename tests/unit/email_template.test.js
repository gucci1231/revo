const assert = require('assert');

describe('Email Template Feature & Validation Unit Tests', () => {
  // Helper for placeholder replacement simulation
  function renderTemplate(text, visitor, meta = {}) {
    if (!text) return '';
    let res = text;
    const vName = visitor.name || visitor.visitor_name || '';
    const vDate = visitor.eventDate || visitor.event_date || '';
    const vProf = visitor.profession || '';
    const vComp = visitor.company || '';
    const vInviter = visitor.inviter || '';
    const mainPresenter = meta.mainPresenter || '未定';
    const wanted = meta.wanted || 'なし';

    // Matching block
    let matchingBlock = '';
    if (visitor.matchingReq) {
      matchingBlock = 
        "\n━━━━━━━━━━━━━━━━━━━━\n" +
        "🌟 マッチングのご要望について\n" +
        "「" + visitor.matchingReq + "」に関するご要望、承知いたしました！\n" +
        "当日、最適なメンバーとお繋ぎできるよう現在調整を進めております。楽しみにしていてくださいね！\n" +
        "━━━━━━━━━━━━━━━━━━━━\n";
    }

    res = res.replace(/\{\$(name|visitor_name)\}/g, vName)
             .replace(/\{\$(event_date|date)\}/g, vDate)
             .replace(/\{\$profession\}/g, vProf)
             .replace(/\{\$company\}/g, vComp)
             .replace(/\{\$inviter\}/g, vInviter)
             .replace(/\{\$main_presenter\}/g, mainPresenter)
             .replace(/\{\$wanted\}/g, wanted)
             .replace(/\{\$matching_status\}/g, matchingBlock);

    return res;
  }

  // Helper for template validation
  function validateTemplate(subject, body) {
    const errors = [];
    const warnings = [];

    if (!subject || subject.trim() === '') {
      errors.push('件名が入力されていません。');
    }
    if (!body || body.trim() === '') {
      errors.push('本文が入力されていません。');
    }

    // Check for unclosed tag syntax
    const unclosedMatch = (subject + ' ' + body).match(/\{\$[a-zA-Z0-9_]*(?![a-zA-Z0-9_]*\})/g);
    if (unclosedMatch) {
      // check if literally unmatched
      const allMatches = (subject + ' ' + body).match(/\{\$[^}]*$/m);
      if (allMatches) {
        warnings.push('閉じ括弧 "}" がないタグの可能性があります。');
      }
    }

    // Check valid known tags
    const validTags = [
      'name', 'visitor_name', 'event_date', 'date', 'profession',
      'company', 'inviter', 'main_presenter', 'wanted', 'matching_status',
      'ras_message', 'referral_message'
    ];
    const extractedTags = [];
    const tagRegex = /\{\$([a-zA-Z0-9_]+)\}/g;
    let match;
    const combined = subject + ' ' + body;
    while ((match = tagRegex.exec(combined)) !== null) {
      extractedTags.push(match[1]);
      if (!validTags.includes(match[1])) {
        warnings.push(`未定義のタグ "{$${match[1]}}" が含まれています。`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedTags: [...new Set(extractedTags)]
    };
  }

  it('correctly replaces placeholders with visitor data', () => {
    const template = '{$name} 様（{$profession}）、{$event_date} のご参加ありがとうございます。紹介者: {$inviter} 様';
    const visitor = {
      name: '山田 太郎',
      profession: '税理士',
      eventDate: '09/04',
      inviter: '田中 一郎'
    };
    const rendered = renderTemplate(template, visitor);
    assert.strictEqual(rendered, '山田 太郎 様（税理士）、09/04 のご参加ありがとうございます。紹介者: 田中 一郎 様');
  });

  it('correctly injects dynamic matching request block when present', () => {
    const template = 'ご参加ありがとうございます。{$matching_status}当日お待ちしております。';
    const visitorWithReq = {
      name: '佐藤 花子',
      matchingReq: 'Webデザイナーと協業したい'
    };
    const rendered = renderTemplate(template, visitorWithReq);
    assert.ok(rendered.includes('Webデザイナーと協業したい'));
    assert.ok(rendered.includes('🌟 マッチングのご要望について'));

    const visitorWithoutReq = { name: '佐藤 花子', matchingReq: '' };
    const renderedEmpty = renderTemplate(template, visitorWithoutReq);
    assert.strictEqual(renderedEmpty, 'ご参加ありがとうございます。当日お待ちしております。');
  });

  it('validates required fields and reports empty subject or body', () => {
    const result1 = validateTemplate('', '本文のみ');
    assert.strictEqual(result1.isValid, false);
    assert.ok(result1.errors.some(e => e.includes('件名')));

    const result2 = validateTemplate('件名のみ', '');
    assert.strictEqual(result2.isValid, false);
    assert.ok(result2.errors.some(e => e.includes('本文')));

    const result3 = validateTemplate('件名あり', '本文あり');
    assert.strictEqual(result3.isValid, true);
    assert.strictEqual(result3.errors.length, 0);
  });

  it('warns on unknown tag names and collects extracted tags', () => {
    const result = validateTemplate(
      '【定例会】{$name} 様へ',
      'ご参加ありがとうございます。{$unknown_tag} をご確認ください。{$event_date}'
    );
    assert.strictEqual(result.isValid, true);
    assert.ok(result.warnings.some(w => w.includes('unknown_tag')));
    assert.deepStrictEqual(result.extractedTags.sort(), ['event_date', 'name', 'unknown_tag'].sort());
  });
});
