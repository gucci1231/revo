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
    assert.ok(utilsHtml.includes('FOLLOW_TYPE_CONFIG'), 'Utils should define FOLLOW_TYPE_CONFIG');
    assert.ok(utilsHtml.includes('申込書提出'), 'JOIN_STATUS_CONFIG should contain 申込書提出');
    assert.ok(utilsHtml.includes('審査'), 'JOIN_STATUS_CONFIG should contain 審査');
    assert.ok(utilsHtml.includes('入金待ち'), 'JOIN_STATUS_CONFIG should contain 入金待ち');
    assert.ok(utilsHtml.includes('入会済'), 'JOIN_STATUS_CONFIG should contain 入会済');
    assert.ok(utilsHtml.includes('フォロー'), 'FOLLOW_TYPE_CONFIG should contain フォロー');
    assert.ok(utilsHtml.includes('時期尚早'), 'FOLLOW_TYPE_CONFIG should contain 時期尚早');
    assert.ok(utilsHtml.includes('関係維持'), 'FOLLOW_TYPE_CONFIG should contain 関係維持');
    assert.ok(utilsHtml.includes('終了'), 'FOLLOW_TYPE_CONFIG should contain 終了');
    assert.ok(utilsHtml.includes('state-applying'), 'Utils should support state-applying class');
    assert.ok(utilsHtml.includes('state-review'), 'Utils should support state-review class');
    assert.ok(utilsHtml.includes('state-payment'), 'Utils should support state-payment class');
  });

  it('uses centralized status helper functions across ViewVisitorDetail and ViewPriorityFollow', () => {
    assert.ok(visitorDetailHtml.includes('vd-select-joined'));
    assert.ok(visitorDetailHtml.includes('vd-select-follow-type'));
    assert.ok(viewPriorityFollowHtml.includes('renderJoinStatusOptionsHtml(st.isJoined)'));
    assert.ok(viewPriorityFollowHtml.includes('joinInfo.cls'));
  });

  it('verifies centralized JOIN_STATUS_CONFIG and helper functions in Utils.html', () => {
    assert.ok(utilsHtml.includes('JOIN_STATUS_CONFIG'), 'Utils should define JOIN_STATUS_CONFIG');
    assert.ok(utilsHtml.includes('normalizeJoinStatus'), 'Utils should define normalizeJoinStatus');
    assert.ok(utilsHtml.includes('getJoinStatusInfo'), 'Utils should define getJoinStatusInfo');
    assert.ok(utilsHtml.includes('renderJoinStatusOptionsHtml'), 'Utils should define renderJoinStatusOptionsHtml');
    assert.ok(utilsHtml.includes('FOLLOW_TYPE_CONFIG'), 'Utils should define FOLLOW_TYPE_CONFIG');
    assert.ok(utilsHtml.includes('normalizeFollowType'), 'Utils should define normalizeFollowType');
  });

  it('compiles new join status options into index.html', () => {
    assert.ok(indexHtml.includes('<option value="申込書提出"'));
    assert.ok(indexHtml.includes('<option value="審査"'));
    assert.ok(indexHtml.includes('<option value="入金待ち"'));
    assert.ok(indexHtml.includes('<option value="入会済"'));
    assert.ok(indexHtml.includes('<option value="フォロー"'));
    assert.ok(indexHtml.includes('<option value="時期尚早"'));
    assert.ok(indexHtml.includes('<option value="関係維持"'));
    assert.ok(indexHtml.includes('<option value="フォロー終了"'));
  });

  it('ensures detail API and Repository correctly include and persist followType and closed statuses', () => {
    const visitorControllerPhp = fs.readFileSync(path.join(__dirname, '../../api/Controllers/VisitorController.php'), 'utf8');
    const visitorRepositoryPhp = fs.readFileSync(path.join(__dirname, '../../api/Repositories/VisitorRepository.php'), 'utf8');

    // VisitorController must output followType in detail() response
    assert.ok(visitorControllerPhp.includes("'followType' => $status['follow_type']"), 'VisitorController detail status should include followType');
    // VisitorRepository must query follow_type in getVisitsByVisitorIds and getStatusByVisitorId
    assert.ok(visitorRepositoryPhp.includes("COALESCE(s.follow_type, '直近フォロー') as followType"), 'VisitorRepository getVisitsByVisitorIds should include followType');
    assert.ok(visitorRepositoryPhp.includes("'フォロー終了' => 1"), 'VisitorRepository joinedPriority should include フォロー終了');
  });

  it('verifies ViewVisitors correctly filters closed visitors with followType = フォロー終了', () => {
    const viewVisitorsHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/ViewVisitors.html'), 'utf8');
    assert.ok(viewVisitorsHtml.includes("followType === 'フォロー終了'"), 'ViewVisitors should check followType === フォロー終了');
  });
});
