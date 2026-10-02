const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('👥 Event Participants & Role Selection Feature Tests', () => {
  const indexHtmlPath = path.join(__dirname, '../../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  it('verifies Database.php and dev-server.js include participants column in chapter_events and meeting_customizations', () => {
    const dbPhpPath = path.join(__dirname, '../../api/Core/Database.php');
    const dbPhp = fs.readFileSync(dbPhpPath, 'utf8');
    assert.ok(dbPhp.includes('ALTER TABLE chapter_events ADD COLUMN participants TEXT DEFAULT'), 'Database.php has chapter_events participants migration');
    assert.ok(dbPhp.includes('ALTER TABLE meeting_customizations ADD COLUMN participants TEXT DEFAULT'), 'Database.php has meeting_customizations participants migration');

    const devServerPath = path.join(__dirname, '../../dev-server.js');
    const devServer = fs.readFileSync(devServerPath, 'utf8');
    assert.ok(devServer.includes('ALTER TABLE chapter_events ADD COLUMN participants TEXT DEFAULT'), 'dev-server.js has chapter_events participants migration');
    assert.ok(devServer.includes('ALTER TABLE meeting_customizations ADD COLUMN participants TEXT DEFAULT'), 'dev-server.js has meeting_customizations participants migration');
  });

  it('verifies EventController.php and EventRepository.php handle participants parameter', () => {
    const ctrlPath = path.join(__dirname, '../../api/Controllers/EventController.php');
    const ctrl = fs.readFileSync(ctrlPath, 'utf8');
    assert.ok(ctrl.includes("'participants' => (string)$this->getParam('participants', '')"), 'EventController saves participants');

    const repoPath = path.join(__dirname, '../../api/Repositories/EventRepository.php');
    const repo = fs.readFileSync(repoPath, 'utf8');
    assert.ok(repo.includes("'participants' => trim($data['participants'] ?? '')"), 'EventRepository saves participants');
  });

  it('verifies chapter event modal contains participants UI elements in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="ch-ev-participants-section"'), 'Modal has ch-ev-participants-section');
    assert.ok(indexHtml.includes('id="ch-ev-role-presets"'), 'Modal has role quick select presets');
    assert.ok(indexHtml.includes("toggleRoleParticipants('all')"), 'Modal has 全員 preset button');
    assert.ok(indexHtml.includes("toggleRoleParticipants('3yaku')"), 'Modal has 三役 preset button');
    assert.ok(indexHtml.includes("toggleRoleParticipants('vh')"), 'Modal has ビジターホスト preset button');
    assert.ok(indexHtml.includes("toggleRoleParticipants('event')"), 'Modal has イベント委員 preset button');
    assert.ok(indexHtml.includes('id="ch-ev-participants-chips"'), 'Modal has selected participants chips');
    assert.ok(indexHtml.includes('id="ch-ev-member-grid"'), 'Modal has individual member selector grid');
    assert.ok(indexHtml.includes('id="ch-ev-custom-participant"'), 'Modal has custom participant text input');
    assert.ok(indexHtml.includes('id="ch-ev-participants"'), 'Modal has ch-ev-participants hidden input');
  });

  it('verifies chapter event detail modal contains participants display elements in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="ch-detail-participants-wrap"'), 'Detail modal has participants wrap');
    assert.ok(indexHtml.includes('id="ch-detail-participants-count"'), 'Detail modal has participants count badge');
    assert.ok(indexHtml.includes('id="ch-detail-participants-list"'), 'Detail modal has participants list container');
  });

  it('verifies meeting detail and edit modals contain participants UI elements in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="modal-meeting-participants-wrap"'), 'Meeting detail has participants wrap');
    assert.ok(indexHtml.includes('id="mt-edit-participants-section"'), 'Meeting edit has participants section');
    assert.ok(indexHtml.includes('id="mt-edit-participants"'), 'Meeting edit has hidden participants input');
  });

  it('verifies getMemberRoleKeys logic categorizes members accurately', () => {
    const fnMatch = indexHtml.match(/function getMemberRoleKeys\(roleStr\s*=\s*''\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fnMatch, 'getMemberRoleKeys function found in index.html');
    
    const getMemberRoleKeys = new Function('roleStr', `
      ${fnMatch[0]}
      return getMemberRoleKeys(roleStr);
    `);

    assert.ok(getMemberRoleKeys('プレジデント / BCP委員会').includes('3yaku'));
    assert.ok(getMemberRoleKeys('バイスプレジデント').includes('3yaku'));
    assert.ok(getMemberRoleKeys('書記/会計').includes('3yaku'));
    assert.ok(getMemberRoleKeys('エデュケーションコーディネーター / ビジターホスト').includes('45yaku'));
    assert.ok(getMemberRoleKeys('エデュケーションコーディネーター / ビジターホスト').includes('vh'));
    assert.ok(getMemberRoleKeys('メンバーシップ委員 / ビジターホスト / イベント委員').includes('ms'));
    assert.ok(getMemberRoleKeys('メンバーシップ委員 / ビジターホスト / イベント委員').includes('vh'));
    assert.ok(getMemberRoleKeys('メンバーシップ委員 / ビジターホスト / イベント委員').includes('event'));
    assert.ok(getMemberRoleKeys('BODコーディネーター / ビジターホスト').includes('bod'));
    assert.ok(getMemberRoleKeys('1to1コーディネーター / メンバーシップ委員').includes('1to1'));
  });

  it('verifies parseParticipantsList correctly normalizes comma-separated, JSON and array inputs', () => {
    const fnMatch = indexHtml.match(/function parseParticipantsList\(val\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fnMatch, 'parseParticipantsList function found in index.html');

    const parseParticipantsList = new Function('val', `
      ${fnMatch[0]}
      return parseParticipantsList(val);
    `);

    assert.deepStrictEqual(parseParticipantsList('永井 創太, 川口 陽平 , 小山 世次'), ['永井 創太', '川口 陽平', '小山 世次']);
    assert.deepStrictEqual(parseParticipantsList('["永井 創太", "川口 陽平"]'), ['永井 創太', '川口 陽平']);
    assert.deepStrictEqual(parseParticipantsList(['永井 創太', '川口 陽平']), ['永井 創太', '川口 陽平']);
    assert.deepStrictEqual(parseParticipantsList(''), []);
    assert.deepStrictEqual(parseParticipantsList(null), []);
  });
});
