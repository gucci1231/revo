const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Join Status Options & UI Unit Tests', () => {
  const utilsHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/Utils.html'), 'utf8');
  const visitorDetailHtml = fs.readFileSync(path.join(__dirname, '../../src/ViewVisitorDetail.html'), 'utf8');
  const viewPriorityFollowHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/ViewPriorityFollow.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  it('renders all join statuses (未, 検討中, 申込書提出, メンバーシップ審査, 入金待ち, 入会済, 見送り) in Utils renderJoinedButtonHtml', () => {
    assert.ok(utilsHtml.includes('<option value="申込書提出"'), 'Utils should contain 申込書提出 option');
    assert.ok(utilsHtml.includes('<option value="メンバーシップ審査"'), 'Utils should contain メンバーシップ審査 option');
    assert.ok(utilsHtml.includes('<option value="入金待ち"'), 'Utils should contain 入金待ち option');
    assert.ok(utilsHtml.includes('state-applying'), 'Utils should support state-applying class');
    assert.ok(utilsHtml.includes('state-review'), 'Utils should support state-review class');
    assert.ok(utilsHtml.includes('state-payment'), 'Utils should support state-payment class');
  });

  it('includes new join statuses in ViewVisitorDetail and ViewPriorityFollow', () => {
    assert.ok(visitorDetailHtml.includes('<option value="申込書提出">入会: 申込書提出</option>'));
    assert.ok(visitorDetailHtml.includes('<option value="メンバーシップ審査">入会: メンバーシップ審査</option>'));
    assert.ok(visitorDetailHtml.includes('<option value="入金待ち">入会: 入金待ち</option>'));

    assert.ok(viewPriorityFollowHtml.includes('<option value="申込書提出"'));
    assert.ok(viewPriorityFollowHtml.includes('<option value="メンバーシップ審査"'));
    assert.ok(viewPriorityFollowHtml.includes('<option value="入金待ち"'));
  });

  it('compiles new join status options into index.html', () => {
    assert.ok(indexHtml.includes('<option value="申込書提出"'));
    assert.ok(indexHtml.includes('<option value="メンバーシップ審査"'));
    assert.ok(indexHtml.includes('<option value="入金待ち"'));
    assert.ok(indexHtml.includes('.status-select.state-applying'));
  });
});
