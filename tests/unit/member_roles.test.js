const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('👔 Member Roles Reflection Feature Tests', () => {
  const indexHtmlPath = path.join(__dirname, '../../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const dbPath = path.join(__dirname, '../../api/data/database.sqlite');

  it('verifies SQLite members table has role column and 3rd term roles are populated', () => {
    const out = execSync(`sqlite3 -json "${dbPath}" "SELECT name, role FROM members WHERE name IN ('永井 創太', '川口 陽平', '前井 宏之', '三島 文美');"`, { encoding: 'utf8' });
    const records = JSON.parse(out || '[]');
    
    assert.strictEqual(records.length, 4);
    
    const nagai = records.find(r => r.name === '永井 創太');
    assert.ok(nagai, 'Nagai found');
    assert.ok(nagai.role.includes('プレジデント'), 'Nagai has President role');

    const kawaguchi = records.find(r => r.name === '川口 陽平');
    assert.ok(kawaguchi, 'Kawaguchi found');
    assert.ok(kawaguchi.role.includes('バイスプレジデント'), 'Kawaguchi has VP role');

    const maei = records.find(r => r.name === '前井 宏之');
    assert.ok(maei, 'Maei found');
    assert.ok(maei.role.includes('エデュケーションコーディネーター'), 'Maei has Education Coordinator role');

    const mishima = records.find(r => r.name === '三島 文美');
    assert.ok(mishima, 'Mishima found');
    assert.ok(mishima.role.includes('ビジターホストコーディネーター'), 'Mishima has VH Coordinator role');
  });

  it('verifies Member Master table header contains 役職 column in index.html', () => {
    assert.ok(indexHtml.includes('<th>役職</th>'), 'Member Master table has 役職 th header');
  });

  it('verifies Member CRUD Modal contains role input in index.html', () => {
    assert.ok(indexHtml.includes('id="crud-m-role"'), 'Member CRUD modal has crud-m-role input');
  });

  it('verifies Member Personal Dashboard header contains member-dash-role-badge in index.html', () => {
    assert.ok(indexHtml.includes('id="member-dash-role-badge"'), 'Member dashboard header has member-dash-role-badge');
  });

  it('verifies Config.js REVO_MEMBERS contains role definitions', () => {
    const configPath = path.join(__dirname, '../../src/Config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    assert.ok(configContent.includes('role: "プレジデント / BCP委員会"'), 'Config.js has Nagai role');
    assert.ok(configContent.includes('role: "バイスプレジデント"'), 'Config.js has Kawaguchi role');
    assert.ok(configContent.includes('role: "ビジターホストコーディネーター"'), 'Config.js has Mishima role');
  });
});
