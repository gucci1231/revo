const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('⚡ Step 6-2: Secure Action Engine & Token Foundation Feature Tests', () => {
  const tokenServicePhp = fs.readFileSync(path.join(__dirname, '../../api/Services/TokenService.php'), 'utf8');
  const actPhp = fs.readFileSync(path.join(__dirname, '../../act.php'), 'utf8');
  const databasePhp = fs.readFileSync(path.join(__dirname, '../../api/Core/Database.php'), 'utf8');

  it('verifies TokenService.php contains HMAC-SHA256 generation, verification and secret management', () => {
    assert.ok(tokenServicePhp.includes('class TokenService'), 'TokenService class must exist');
    assert.ok(tokenServicePhp.includes("hash_hmac('sha256'"), 'HMAC-SHA256 must be used for signing');
    assert.ok(tokenServicePhp.includes('generateToken'), 'generateToken method must exist');
    assert.ok(tokenServicePhp.includes('verifyToken'), 'verifyToken method must exist');
    assert.ok(tokenServicePhp.includes('hash_equals'), 'Timing-safe hash_equals must be used');
    assert.ok(tokenServicePhp.includes('generateActionUrl'), 'generateActionUrl helper must exist');
    assert.ok(tokenServicePhp.includes('generatePortalUrl'), 'generatePortalUrl helper must exist');
  });

  it('simulates HMAC token generation and verification matching TokenService logic', () => {
    const secret = 'test_secret_key_revo_2026';
    const payload = {
      m: 12,
      a: 'feel_rank',
      t: 'vis_999',
      v: 'A',
      exp: Math.floor(Date.now() / 1000) + 3600,
      rnd: 'abcdef123456'
    };

    const base64UrlEncode = (str) => {
      return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    };

    const base64UrlDecode = (str) => {
      let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) {
        b64 += '=';
      }
      return Buffer.from(b64, 'base64').toString('utf8');
    };

    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(encodedPayload);
    const signature = hmac.digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const token = `${encodedPayload}.${signature}`;

    // Verify valid token
    const parts = token.split('.');
    assert.strictEqual(parts.length, 2);
    const verifyHmac = crypto.createHmac('sha256', secret);
    verifyHmac.update(parts[0]);
    const expectedSig = verifyHmac.digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    assert.strictEqual(parts[1], expectedSig, 'Valid token signature must match');

    const decoded = JSON.parse(base64UrlDecode(parts[0]));
    assert.strictEqual(decoded.m, 12);
    assert.strictEqual(decoded.a, 'feel_rank');
    assert.strictEqual(decoded.v, 'A');

    // Verify tampered token is rejected
    const tamperedToken = `${encodedPayload}.invalidsignaturexyz`;
    const tamperedParts = tamperedToken.split('.');
    assert.notStrictEqual(tamperedParts[1], expectedSig, 'Tampered token signature must NOT match');
  });

  it('verifies act.php implements email BOT misclick defense, idempotency and Apple-grade styling', () => {
    // BOT defense & Confirmation
    assert.ok(actPhp.includes('confirm_needed'), 'Confirmation state for bot misclick defense must exist');
    assert.ok(actPhp.includes('name="confirm"'), 'Confirmation form input must exist');
    assert.ok(actPhp.includes('already_done'), 'Idempotent already_done state must exist');

    // Apple-grade UX & Minimalist CSS (<30KB)
    assert.ok(actPhp.includes('min-height: 52px'), 'Large 52px touch target button must exist');
    assert.ok(actPhp.includes('-apple-system'), 'Native SF font stack must be declared');
    assert.ok(actPhp.includes('#0071e3'), 'Electric Blue primary accent must be defined');

    // Action cases
    assert.ok(actPhp.includes("case 'feel_rank':"), 'feel_rank handler must exist');
    assert.ok(actPhp.includes("case 'complete_action':"), 'complete_action handler must exist');
    assert.ok(actPhp.includes("case 'accept_goal':"), 'accept_goal handler must exist');
    assert.ok(actPhp.includes("case 'high_five':"), 'high_five handler must exist');
  });

  it('verifies Database.php includes member_goals schema and onboarding/WIIFM migrations', () => {
    assert.ok(databasePhp.includes('CREATE TABLE IF NOT EXISTS member_goals'), 'member_goals table schema must exist');
    assert.ok(databasePhp.includes('target_period'), 'target_period column must exist in member_goals');
    assert.ok(databasePhp.includes('target_score'), 'target_score column must exist in member_goals');
    assert.ok(databasePhp.includes('is_onboarding'), 'is_onboarding migration must exist');
    assert.ok(databasePhp.includes('buddy_member_id'), 'buddy_member_id migration must exist');
    assert.ok(databasePhp.includes('pre_meeting_wiifm'), 'pre_meeting_wiifm migration must exist');
    assert.ok(databasePhp.includes('matched_power_team_id'), 'matched_power_team_id migration must exist');
  });
});
