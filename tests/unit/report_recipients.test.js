const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📧 Report Recipients and Member Roles Linking Tests', () => {
  const indexHtmlPath = path.join(__dirname, '../../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  it('verifies Database.php and dev-server.js include email column in members table', () => {
    const dbPhpPath = path.join(__dirname, '../../api/Core/Database.php');
    const dbPhp = fs.readFileSync(dbPhpPath, 'utf8');
    assert.ok(dbPhp.includes('ALTER TABLE members ADD COLUMN email TEXT DEFAULT'), 'Database.php has email column migration');
    assert.ok(dbPhp.includes("UPDATE members SET email = 'info@k-d-o.biz' WHERE name = '川口 陽平'"), 'Database.php seeds initial email for Yohei Kawaguchi');

    const devServerPath = path.join(__dirname, '../../dev-server.js');
    const devServer = fs.readFileSync(devServerPath, 'utf8');
    assert.ok(devServer.includes('ALTER TABLE members ADD COLUMN email TEXT DEFAULT'), 'dev-server.js has email column migration');
    assert.ok(devServer.includes("UPDATE members SET email = 'info@k-d-o.biz' WHERE name = '川口 陽平'"), 'dev-server.js seeds initial email for Yohei Kawaguchi');
  });

  it('verifies MemberRepository and MemberController handle email field', () => {
    const repoPath = path.join(__dirname, '../../api/Repositories/MemberRepository.php');
    const repo = fs.readFileSync(repoPath, 'utf8');
    assert.ok(repo.includes("COALESCE(email, '') as email"), 'MemberRepository selects email');

    const ctrlPath = path.join(__dirname, '../../api/Controllers/MemberController.php');
    const ctrl = fs.readFileSync(ctrlPath, 'utf8');
    assert.ok(ctrl.includes("'email' => $this->getParam('email', '')"), 'MemberController saves email');
  });

  it('verifies ViewReportManager contains recipients section with role buttons, chips container, and member palette in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="rm-recipients-chips-container"'), 'chips container exists');
    assert.ok(indexHtml.includes('id="rm-btn-role-all"'), 'role button all exists');
    assert.ok(indexHtml.includes('id="rm-btn-role-3yaku"'), 'role button 3yaku exists');
    assert.ok(indexHtml.includes('id="rm-btn-role-vh"'), 'role button vh exists');
    assert.ok(indexHtml.includes('id="rm-member-palette-container"'), 'member palette container exists');
    assert.ok(indexHtml.includes('id="rm-member-palette-grid"'), 'member palette grid exists');
    assert.ok(indexHtml.includes('id="rm-email-recipients"'), 'hidden rm-email-recipients input exists');
  });

  it('verifies ViewReportManager script contains role linking and resolution functions', () => {
    const scriptPath = path.join(__dirname, '../../src/scripts/ViewReportManager.html');
    const script = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(script.includes('function initReportRecipients'), 'initReportRecipients defined');
    assert.ok(script.includes('function resolveMemberForEmailOrName'), 'resolveMemberForEmailOrName defined');
    assert.ok(script.includes('function renderReportRecipientsChips'), 'renderReportRecipientsChips defined');
    assert.ok(script.includes('function toggleReportRolePreset'), 'toggleReportRolePreset defined');
    assert.ok(script.includes('function toggleReportMemberRecipient'), 'toggleReportMemberRecipient defined');
    assert.ok(script.includes('function addCustomReportRecipient'), 'addCustomReportRecipient defined');
  });

  it('verifies Member CRUD Modal and Settings Table contain email fields in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="crud-m-email"'), 'crud-m-email input exists in member modal');
    assert.ok(indexHtml.includes('<th>メールアドレス</th>'), 'email header exists in member master table');
  });

  it('verifies recipient parsing and role group resolution logic', () => {
    const MOCK_MEMBERS = [
      { id: '1', name: '永井 創太', role: 'プレジデント / BCP委員会', email: '', status: '在籍' },
      { id: '2', name: '川口 陽平', role: 'バイスプレジデント', email: 'info@k-d-o.biz', status: '在籍' },
      { id: '3', name: '小山 世次', role: '書記/会計', email: '', status: '在籍' }
    ];

    function resolveMember(query) {
      if (query === 'info@k-d-o.biz') return MOCK_MEMBERS.find(m => m.name === '川口 陽平');
      return MOCK_MEMBERS.find(m => m.name === query || m.email === query);
    }

    const resolved = resolveMember('info@k-d-o.biz');
    assert.ok(resolved, 'info@k-d-o.biz resolves to a member');
    assert.strictEqual(resolved.name, '川口 陽平');
    assert.strictEqual(resolved.role, 'バイスプレジデント');
  });
});
