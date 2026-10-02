const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('🤝 Step 6-9: Pre-Meeting WIIFM & Power Team Matching Feature Tests', () => {
  const matcherPhp = fs.readFileSync(path.join(__dirname, '../../api/Services/PowerTeamMatcher.php'), 'utf8');
  const visitorRepoPhp = fs.readFileSync(path.join(__dirname, '../../api/Repositories/VisitorRepository.php'), 'utf8');
  const visitorCtrlPhp = fs.readFileSync(path.join(__dirname, '../../api/Controllers/VisitorController.php'), 'utf8');
  const apiServiceHtml = fs.readFileSync(path.join(__dirname, '../../src/ApiService.html'), 'utf8');
  const modalVisitorCrudHtml = fs.readFileSync(path.join(__dirname, '../../src/ModalVisitorCrud.html'), 'utf8');
  const compiledIndexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  const devServerJs = fs.readFileSync(path.join(__dirname, '../../dev-server.js'), 'utf8');

  it('verifies PowerTeamMatcher.php suggests power teams based on profession and business challenge', () => {
    assert.ok(matcherPhp.includes('class PowerTeamMatcher'), 'PowerTeamMatcher class must exist');
    assert.ok(matcherPhp.includes('suggestPowerTeam'), 'suggestPowerTeam method must exist');
    assert.ok(matcherPhp.includes('士業・財務・コンサル PT'), 'Finance/Legal PT must be defined');
    assert.ok(matcherPhp.includes('不動産・建築・住まい PT'), 'Real Estate/Construction PT must be defined');
    assert.ok(matcherPhp.includes('Web・マーケ・クリエイティブ PT'), 'Web/Marketing PT must be defined');
    assert.ok(matcherPhp.includes('健康・美容・ウェルネス PT'), 'Health/Beauty PT must be defined');
  });

  it('verifies VisitorRepository and Controller support preMeetingWiifm and matchedPowerTeamId', () => {
    assert.ok(visitorRepoPhp.includes('preMeetingWiifm'), 'VisitorRepository must select preMeetingWiifm');
    assert.ok(visitorRepoPhp.includes('matchedPowerTeamId'), 'VisitorRepository must select matchedPowerTeamId');
    assert.ok(visitorRepoPhp.includes('updatePreMeetingWiifm'), 'VisitorRepository must implement updatePreMeetingWiifm');

    assert.ok(visitorCtrlPhp.includes('powerTeamSuggestion'), 'VisitorController must include powerTeamSuggestion in detail');
    assert.ok(visitorCtrlPhp.includes('updateWiifm'), 'VisitorController must handle update_wiifm action');
  });

  it('verifies ApiService.html and dev-server.js support updateVisitorWiifmApi', () => {
    assert.ok(apiServiceHtml.includes('updateVisitorWiifmApi'), 'ApiService must have updateVisitorWiifmApi mapping');
    assert.ok(devServerJs.includes("action === 'update_wiifm'"), 'dev-server.js must handle update_wiifm');
    assert.ok(devServerJs.includes('pre_meeting_wiifm'), 'dev-server.js must persist pre_meeting_wiifm');
  });

  it('verifies compiled index.html contains WIIFM and Power Team matching UI elements', () => {
    assert.ok(compiledIndexHtml.includes('id="vd-wiifm-display"'), 'Must have vd-wiifm-display element in detail view');
    assert.ok(compiledIndexHtml.includes('id="vd-matched-pt-name"'), 'Must have vd-matched-pt-name element');
    assert.ok(compiledIndexHtml.includes('id="vd-matched-pt-members"'), 'Must have vd-matched-pt-members element');
    assert.ok(compiledIndexHtml.includes('saveVisitorWiifm'), 'Must define saveVisitorWiifm function');
    assert.ok(compiledIndexHtml.includes('id="crud-v-wiifm"'), 'Must have crud-v-wiifm in visitor modal');
  });
});
