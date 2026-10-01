const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('📞 Visitor Phone Number Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  const dbPhp = fs.readFileSync(path.join(__dirname, '../../api/Core/Database.php'), 'utf8');
  const repoPhp = fs.readFileSync(path.join(__dirname, '../../api/Repositories/VisitorRepository.php'), 'utf8');
  const controllerPhp = fs.readFileSync(path.join(__dirname, '../../api/Controllers/VisitorController.php'), 'utf8');
  const syncPhp = fs.readFileSync(path.join(__dirname, '../../api/Services/SyncService.php'), 'utf8');
  const devServerJs = fs.readFileSync(path.join(__dirname, '../../dev-server.js'), 'utf8');

  it('verifies SQLite visitors schema in Database.php includes phone column and migration', () => {
    assert(dbPhp.includes('phone TEXT DEFAULT \'\''), 'Database.php should define phone column in visitors table');
    assert(dbPhp.includes('ALTER TABLE visitors ADD COLUMN phone TEXT DEFAULT \'\''), 'Database.php should have migration for phone column');
    assert(dbPhp.includes('WHERE remarks LIKE \'%TEL:%\' AND (phone IS NULL OR phone = \'\')'), 'Database.php should have backfill query for remarks TEL');
  });

  it('verifies VisitorRepository includes phone column in queries', () => {
    assert(repoPhp.includes("COALESCE(v.phone, '') as phone"), 'getAllWithStatusAndHearing should select phone');
    assert(repoPhp.includes('public function updateVisitor('), 'VisitorRepository should have updateVisitor method');
  });

  it('verifies VisitorController returns phone in detail and accepts in add', () => {
    assert(controllerPhp.includes("'phone' => $visitor['phone'] ?? ''"), 'detail should return phone');
    assert(controllerPhp.includes("'phone' => $this->getParam('phone', '')"), 'add should accept phone parameter');
    assert(controllerPhp.includes('$this->visitorRepo->updateVisitor($id, $data)'), 'add should support update mode when id is provided');
  });

  it('verifies SyncService parses phone numbers from Total and List sheets', () => {
    assert(syncPhp.includes('$this->fetchSheetCsv($spreadsheetId, \'Total\')'), 'SyncService should fetch Total sheet for phone mapping');
    assert(syncPhp.includes('$this->cleanPhone('), 'SyncService should have cleanPhone helper');
    assert(syncPhp.includes("'phone' => $vPhone"), 'SyncService should assign phone to visitors from visitorsRaw');
    assert(syncPhp.includes("'phone' => $phone"), 'SyncService should assign phone to visitors from listRaw');
  });

  it('verifies dev-server.js supports phone in list, detail, and add endpoints', () => {
    assert(devServerJs.includes("COALESCE(v.phone, '') as phone"), 'dev-server.js should select phone in list');
    assert(devServerJs.includes("phone: v.phone || ''"), 'dev-server.js should return phone in detail');
    assert(devServerJs.includes("const phone = esc(input.phone || '');"), 'dev-server.js should handle phone in add');
  });

  it('verifies Visitor Detail View UI elements for phone exist in compiled index.html', () => {
    assert(indexHtml.includes('id="vd-phone-chip"'), 'index.html should have vd-phone-chip');
    assert(indexHtml.includes('id="vd-phone-link"'), 'index.html should have vd-phone-link');
    assert(indexHtml.includes('id="vd-phone"'), 'index.html should have vd-phone');
    assert(indexHtml.includes('id="vd-phone-copy-btn"'), 'index.html should have vd-phone-copy-btn');
    assert(indexHtml.includes('copyVisitorPhone()'), 'index.html should call copyVisitorPhone()');
  });

  it('verifies copyVisitorPhone function exists in compiled index.html script', () => {
    assert(indexHtml.includes('function copyVisitorPhone()'), 'copyVisitorPhone should be defined');
    assert(indexHtml.includes('navigator.clipboard.writeText(val)'), 'copyVisitorPhone should write to clipboard');
  });

  it('verifies search filters in ViewVisitors and ViewVisitorDetail support phone searching', () => {
    assert(indexHtml.includes('phone.includes(search)'), 'filterAllVisitorsTable should search by phone');
    assert(indexHtml.includes('phone.includes(q)'), 'handleVdSidebarSearch should search by phone');
  });

  it('verifies Visitor CRUD modal contains phone input field', () => {
    assert(indexHtml.includes('id="crud-v-phone"'), 'crud-v-phone input should exist in modal');
    assert(indexHtml.includes("document.getElementById('crud-v-phone').value"), 'crud script should get and set phone value');
  });

  it('verifies SQLite database file has phone column and populated data', () => {
    const dbPath = path.join(__dirname, '../../api/data/database.sqlite');
    if (fs.existsSync(dbPath)) {
      const count = execSync(`/usr/bin/sqlite3 "${dbPath}" "SELECT count(*) FROM visitors WHERE phone != '';"`, { encoding: 'utf8' }).trim();
      assert(parseInt(count, 10) > 100, `Expected > 100 visitors with phone numbers, got ${count}`);
    }
  });
});
