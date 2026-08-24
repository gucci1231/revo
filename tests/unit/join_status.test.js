const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Join Status Options & UI Unit Tests', () => {
  const utilsHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/Utils.html'), 'utf8');
  const visitorDetailHtml = fs.readFileSync(path.join(__dirname, '../../src/ViewVisitorDetail.html'), 'utf8');
  const viewPriorityFollowHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/ViewPriorityFollow.html'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  it('defines centralized status configurations and option generators in Utils.html', () => {
    assert.ok(utilsHtml.includes('JOIN_STATUS_CONFIG'), 'Utils should define JOIN_STATUS_CONFIG');
    assert.ok(utilsHtml.includes('申込書提出'), 'JOIN_STATUS_CONFIG should contain 申込書提出');
    assert.ok(utilsHtml.includes('メンバーシップ審査'), 'JOIN_STATUS_CONFIG should contain メンバーシップ審査');
    assert.ok(utilsHtml.includes('入金待ち'), 'JOIN_STATUS_CONFIG should contain 入金待ち');
    assert.ok(utilsHtml.includes('保留（時期尚早）'), 'JOIN_STATUS_CONFIG should contain 保留（時期尚早）');
    assert.ok(utilsHtml.includes('フォロー終了'), 'JOIN_STATUS_CONFIG should contain フォロー終了');
    assert.ok(utilsHtml.includes('state-applying'), 'Utils should support state-applying class');
    assert.ok(utilsHtml.includes('state-review'), 'Utils should support state-review class');
    assert.ok(utilsHtml.includes('state-payment'), 'Utils should support state-payment class');
    assert.ok(utilsHtml.includes('state-pending-later'), 'Utils should support state-pending-later class');
    assert.ok(utilsHtml.includes('state-closed'), 'Utils should support state-closed class');
  });

  it('uses centralized status helper functions across ViewVisitorDetail and ViewPriorityFollow', () => {
    assert.ok(visitorDetailHtml.includes('vd-select-joined'));
    assert.ok(viewPriorityFollowHtml.includes('renderJoinStatusOptionsHtml(st.isJoined)'));
    assert.ok(viewPriorityFollowHtml.includes('joinInfo.cls'));
  });

  it('verifies centralized JOIN_STATUS_CONFIG and helper functions in Utils.html', () => {
    assert.ok(utilsHtml.includes('JOIN_STATUS_CONFIG'), 'Utils should define JOIN_STATUS_CONFIG');
    assert.ok(utilsHtml.includes('normalizeJoinStatus'), 'Utils should define normalizeJoinStatus');
    assert.ok(utilsHtml.includes('getJoinStatusInfo'), 'Utils should define getJoinStatusInfo');
    assert.ok(utilsHtml.includes('renderJoinStatusOptionsHtml'), 'Utils should define renderJoinStatusOptionsHtml');
  });

  it('compiles new join status options into index.html', () => {
    assert.ok(indexHtml.includes('<option value="申込書提出"'));
    assert.ok(indexHtml.includes('<option value="メンバーシップ審査"'));
    assert.ok(indexHtml.includes('<option value="入金待ち"'));
    assert.ok(indexHtml.includes('<option value="保留（時期尚早）"'));
    assert.ok(indexHtml.includes('<option value="フォロー終了"'));
    assert.ok(indexHtml.includes('.status-select.state-applying'));
  });
});
