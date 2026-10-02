const assert = require('assert');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '../../');

describe('🧪 Mail Test Mode & Safety Interception Feature Tests', () => {
  it('verifies MailService.php implements test mode safety interception and redirection', () => {
    const mailServicePath = path.join(rootDir, 'api/Services/MailService.php');
    assert.ok(fs.existsSync(mailServicePath), 'api/Services/MailService.php must exist');
    const content = fs.readFileSync(mailServicePath, 'utf8');

    assert.ok(content.includes('mail_test_mode'), 'MailService must reference mail_test_mode');
    assert.ok(content.includes('mail_test_recipient'), 'MailService must reference mail_test_recipient');
    assert.ok(content.includes('info@k-d-o.biz'), 'Default recipient must be info@k-d-o.biz');
    assert.ok(content.includes('[TEST配信 ➔'), 'Subject must include test prefix');
    assert.ok(content.includes('【テスト配信モード稼働中】'), 'HTML body must prepend test banner');
    assert.ok(content.includes('$isTestRedirected'), 'Redirect flag must be tracked');
  });

  it('verifies SettingRepository.php handles mail_test_mode and mail_test_recipient defaults', () => {
    const settingRepoPath = path.join(rootDir, 'api/Repositories/SettingRepository.php');
    assert.ok(fs.existsSync(settingRepoPath), 'SettingRepository.php must exist');
    const content = fs.readFileSync(settingRepoPath, 'utf8');

    assert.ok(content.includes('mail_test_mode'), 'SettingRepository must set mail_test_mode default');
    assert.ok(content.includes('mail_test_recipient'), 'SettingRepository must set mail_test_recipient default');
  });

  it('verifies ApiService mappings exist for getSettingsApi and updateSettingApi', () => {
    const apiServiceHtmlPath = path.join(rootDir, 'src/ApiService.html');
    const apiServiceJsPath = path.join(rootDir, 'public/js/services/apiService.js');

    const htmlContent = fs.readFileSync(apiServiceHtmlPath, 'utf8');
    const jsContent = fs.readFileSync(apiServiceJsPath, 'utf8');

    assert.ok(htmlContent.includes("case 'getSettingsApi':"), 'ApiService.html must map getSettingsApi');
    assert.ok(htmlContent.includes("case 'updateSettingApi':"), 'ApiService.html must map updateSettingApi');

    assert.ok(jsContent.includes("case 'getSettingsApi':"), 'apiService.js must map getSettingsApi');
    assert.ok(jsContent.includes("case 'updateSettingApi':"), 'apiService.js must map updateSettingApi');
  });

  it('verifies ViewReportManager contains test mode safety banner in compiled index.html', () => {
    const compiledPath = path.join(rootDir, 'index.html');
    const content = fs.readFileSync(compiledPath, 'utf8');

    assert.ok(content.includes('メール送信テスト稼働中'), 'Compiled index.html must contain test mode banner');
    assert.ok(content.includes('info@k-d-o.biz'), 'Compiled index.html must show info@k-d-o.biz');
  });

  it('verifies ViewSettings contains Mail Safety card, toggle, and script controls in compiled index.html', () => {
    const compiledPath = path.join(rootDir, 'index.html');
    const content = fs.readFileSync(compiledPath, 'utf8');

    assert.ok(content.includes('メール配信セーフティ ＆ テスト転送設定'), 'Compiled index.html must contain Mail Safety card');
    assert.ok(content.includes('setting-mail-test-mode'), 'Compiled index.html must contain test mode toggle input');
    assert.ok(content.includes('setting-mail-test-recipient'), 'Compiled index.html must contain test recipient input');
    assert.ok(content.includes('fetchMailTestSettings'), 'Compiled index.html must define fetchMailTestSettings function');
    assert.ok(content.includes('toggleMailTestMode'), 'Compiled index.html must define toggleMailTestMode function');
    assert.ok(content.includes('saveMailTestRecipient'), 'Compiled index.html must define saveMailTestRecipient function');
  });
});
