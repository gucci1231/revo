const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Extract escapeAndLinkify function from Utils.html
const utilsHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/Utils.html'), 'utf8');
const scriptContent = utilsHtml.replace(/<\/?script>/g, '');
const context = {};
const fn = new Function('window', scriptContent + '\nreturn { escapeHtml, escapeAndLinkify, OgpCardService };');
const { escapeHtml, escapeAndLinkify, OgpCardService } = fn(context);

describe('URL Linkify & Auto-link Unit Tests', () => {
  it('converts HTTP and HTTPS URLs into clickable anchor tags and generates OGP container', () => {
    const input = '参考リンク: https://revo.k-d-o.biz/#visitor/233 を確認してください。';
    const output = escapeAndLinkify(input, false, true);
    
    assert.strictEqual(output.includes('<a href="https://revo.k-d-o.biz/#visitor/233" target="_blank" rel="noopener noreferrer"'), true);
    assert.strictEqual(output.includes('https://revo.k-d-o.biz/#visitor/233 <i class="fa-solid fa-arrow-up-right-from-square'), true);
    assert.strictEqual(output.includes('data-ogp-url="https://revo.k-d-o.biz/#visitor/233"'), true);
    assert.strictEqual(output.includes('class="ogp-card-container"'), true);
  });

  it('suppresses OGP container when showCard is false', () => {
    const input = '参考リンク: https://revo.k-d-o.biz/#visitor/233';
    const output = escapeAndLinkify(input, false, false);
    
    assert.strictEqual(output.includes('<a href="https://revo.k-d-o.biz/#visitor/233"'), true);
    assert.strictEqual(output.includes('ogp-card-container'), false);
  });

  it('escapes HTML special characters safely while converting URLs', () => {
    const input = '<script>alert("XSS")</script> & http://example.com/test?a=1&b=2';
    const output = escapeAndLinkify(input, false, false);

    assert.strictEqual(output.includes('<script>'), false);
    assert.strictEqual(output.includes('&lt;script&gt;'), true);
    assert.strictEqual(output.includes('&amp;'), true);
    assert.strictEqual(output.includes('<a href="http://example.com/test?a=1&amp;b=2"'), true);
  });

  it('handles trailing punctuation correctly without including it in the URL', () => {
    const input = '詳細はこちら: https://example.com/info。また、https://example.com/faq!';
    const output = escapeAndLinkify(input, false, false);

    assert.strictEqual(output.includes('href="https://example.com/info"'), true);
    assert.strictEqual(output.includes('href="https://example.com/info。"'), false);
    assert.strictEqual(output.includes('href="https://example.com/faq"'), true);
    assert.strictEqual(output.includes('href="https://example.com/faq!"'), false);
  });

  it('converts newlines to <br> when nl2br is true', () => {
    const input = "1行目\n2行目 https://example.com\n3行目";
    const output = escapeAndLinkify(input, true, false);

    assert.strictEqual(output.includes('1行目<br>2行目'), true);
    assert.strictEqual(output.includes('<a href="https://example.com"'), true);
    assert.strictEqual(output.includes('</a><br>3行目'), true);
  });

  it('renders rich card HTML correctly via OgpCardService.renderCard', () => {
    const mockContainer = {
      innerHTML: '',
      getAttribute: () => 'https://example.com'
    };
    const mockData = {
      url: 'https://example.com',
      domain: 'example.com',
      title: 'テストタイトル',
      description: 'テスト説明文です。',
      image: 'https://example.com/ogp.png',
      site_name: 'テストサイト',
      favicon: 'https://example.com/favicon.ico'
    };

    OgpCardService.renderCard(mockContainer, mockData);
    assert.strictEqual(mockContainer.innerHTML.includes('テストタイトル'), true);
    assert.strictEqual(mockContainer.innerHTML.includes('テスト説明文です。'), true);
    assert.strictEqual(mockContainer.innerHTML.includes('https://example.com/ogp.png'), true);
    assert.strictEqual(mockContainer.innerHTML.includes('テストサイト'), true);
  });

  it('handles empty, null, or undefined inputs gracefully', () => {
    assert.strictEqual(escapeAndLinkify(''), '');
    assert.strictEqual(escapeAndLinkify(null), '');
    assert.strictEqual(escapeAndLinkify(undefined), '');
  });
});
