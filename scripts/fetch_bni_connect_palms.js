#!/usr/bin/env node
/**
 * Node.js CLI Script: fetch_bni_connect_palms.js
 * Automated BNI Connect PALMS crawling for local & CI/CD environment.
 *
 * Usage:
 *   node scripts/fetch_bni_connect_palms.js
 *   node scripts/fetch_bni_connect_palms.js --start=09/17/2026 --end=09/24/2026
 *   node scripts/fetch_bni_connect_palms.js --term=2
 */

const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DB_FILE = path.join(__dirname, '../api/data/database.sqlite');
const LOG_FILE = path.join(__dirname, '../api/data/palms_sync.log');

const USERNAME = process.env.BNI_USERNAME || 'gucci1231@me.com';
const PASSWORD = process.env.BNI_PASSWORD || 'docvk!3Ka.';
const CHAPTER_ID = process.env.BNI_CHAPTER_ID || '42376';

function logMessage(msg) {
  const time = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${time}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {}
}

function getDefaultWeeklyRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 4=Thu
  const thisThu = new Date(today);
  if (dayOfWeek >= 4) {
    thisThu.setDate(today.getDate() - (dayOfWeek - 4));
  } else {
    thisThu.setDate(today.getDate() - (dayOfWeek + 3));
  }
  const lastThu = new Date(thisThu);
  lastThu.setDate(thisThu.getDate() - 7);

  const fmt = d => {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  return {
    startDate: fmt(lastThu),
    endDate: fmt(thisThu)
  };
}

function toIsoDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return dateStr;
}

async function authenticate() {
  const authPayload = JSON.stringify({
    client_id: 'IDENTITY_PORTAL',
    user_id: USERNAME,
    password: PASSWORD
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://api.bniconnectglobal.com/auth-api/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic SURFTlRJVFlfUE9SVEFMOkdjVlN2JE1vODk1d0I2XjRTNA==',
        'Concept': 'CONNECT',
        'suppress-translations': 'y',
        'authorization-version': 'V2',
        'Content-Length': Buffer.byteLength(authPayload)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(b);
          if (json && json.content && json.content.access_token) {
            resolve(json.content);
          } else {
            reject(new Error('Auth failed: ' + b.substring(0, 300)));
          }
        } catch (e) {
          reject(new Error('Auth JSON parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(authPayload);
    req.end();
  });
}

async function establishWebSession(tokens) {
  const postData = querystring.stringify({
    j_refresh: tokens.refresh_token,
    j_access: tokens.access_token,
    j_expiry: tokens.expires_in,
    j_username: USERNAME,
    j_password: PASSWORD,
    j_login_page: 'https://www.bniconnectglobal.com/login/'
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://www.bniconnectglobal.com/web/j_spring_security_jwt_check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': 'AUTH_INIT=Connect; Max-Age=28800; path=/web; Secure',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      const setCookies = res.headers['set-cookie'] || [];
      const jsession = setCookies.find(c => c.startsWith('JSESSIONID='));
      if (jsession) {
        resolve(jsession.split(';')[0]);
      } else {
        reject(new Error('Failed to get JSESSIONID from check response'));
      }
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchPalmsReportHtml(jsessionCookie, startDate, endDate) {
  const targetUrl = `/web/secure/reportsChapterPALMS?IdOrg=${CHAPTER_ID}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&ShowDetails=false&__exports_details=1`;

  const containerHtml = await new Promise((resolve, reject) => {
    const req = https.request('https://www.bniconnectglobal.com' + targetUrl, {
      method: 'GET',
      headers: {
        'Cookie': `${jsessionCookie}; AUTH_INIT=Connect`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.end();
  });

  const m = containerHtml.match(/src="([^"]*secureWebReport[^"]*)"/i);
  if (!m) {
    throw new Error('IFrame src for secureWebReport not found in container response.');
  }

  const iframeSrc = m[1].replace(/&amp;/g, '&');
  return new Promise((resolve, reject) => {
    const req = https.request('https://www.bniconnectglobal.com' + iframeSrc, {
      method: 'GET',
      headers: {
        'Cookie': `${jsessionCookie}; AUTH_INIT=Connect`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    });
    req.on('error', reject);
    req.end();
  });
}

function parsePalmsHtml(html, startDate, endDate) {
  const isoStartDate = toIsoDate(startDate);
  const isoEndDate = toIsoDate(endDate);

  const records = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const memberMatch = rowHtml.match(/operationsRegionMembershipViewMember\?memberId=(\d+)[^>]*>([^<]+)<\/a>/i);
    if (!memberMatch) continue;

    const memberId = memberMatch[1].trim();
    const memberName = memberMatch[2].trim();

    if (['ビジター', 'BNI', '合計'].includes(memberName)) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    const cells = [];
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    const numValues = [];
    for (let i = 1; i < cells.length; i++) {
      if (!isNaN(parseFloat(cells[i])) && isFinite(cells[i])) {
        numValues.push(parseFloat(cells[i]));
      }
    }

    if (numValues.length < 14) continue;

    const p = Math.round(numValues[0]);
    const a = Math.round(numValues[1]);
    const l = Math.round(numValues[2]);
    const m = Math.round(numValues[3]);
    const s = Math.round(numValues[4]);
    const rgi = Math.round(numValues[5]);
    const rgo = Math.round(numValues[6]);
    const rri = Math.round(numValues[7]);
    const rro = Math.round(numValues[8]);
    const v = Math.round(numValues[9]);
    const oneToOne = Math.round(numValues[10]);
    const tyfcbKyen = numValues[11];
    const ceu = Math.round(numValues[12]);
    const testimonials = Math.round(numValues[13]);

    const recordId = crypto.createHash('sha256').update(`${memberId}_${isoStartDate}_${isoEndDate}`).digest('hex');

    records.push({
      id: recordId,
      member_id: memberId,
      member_name: memberName,
      start_date: isoStartDate,
      end_date: isoEndDate,
      p_present: p,
      a_absent: a,
      l_late: l,
      m_medical: m,
      s_substitute: s,
      rgi_referrals_given_internal: rgi,
      rgo_referrals_given_external: rgo,
      rri_referrals_received_internal: rri,
      rro_referrals_received_external: rro,
      v_visitors: v,
      one_to_ones: oneToOne,
      tyfcb_amount: tyfcbKyen,
      ceu: ceu,
      testimonials: testimonials
    });
  }

  return records;
}

function savePalmsToDb(records) {
  if (!records || records.length === 0) return 0;
  if (!fs.existsSync(DB_FILE)) {
    throw new Error('Database file not found: ' + DB_FILE);
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const sqlLines = ['BEGIN TRANSACTION;'];

  records.forEach(r => {
    const escName = r.member_name.replace(/'/g, "''");
    sqlLines.push(`
      INSERT OR REPLACE INTO palms_reports (
        id, member_id, member_name, start_date, end_date,
        p_present, a_absent, l_late, m_medical, s_substitute,
        rgi_referrals_given_internal, rgo_referrals_given_external,
        rri_referrals_received_internal, rro_referrals_received_external,
        v_visitors, one_to_ones, tyfcb_amount, ceu, testimonials,
        created_at, updated_at
      ) VALUES (
        '${r.id}', '${r.member_id}', '${escName}', '${r.start_date}', '${r.end_date}',
        ${r.p_present}, ${r.a_absent}, ${r.l_late}, ${r.m_medical}, ${r.s_substitute},
        ${r.rgi_referrals_given_internal}, ${r.rgo_referrals_given_external},
        ${r.rri_referrals_received_internal}, ${r.rro_referrals_received_external},
        ${r.v_visitors}, ${r.one_to_ones}, ${r.tyfcb_amount}, ${r.ceu}, ${r.testimonials},
        COALESCE((SELECT created_at FROM palms_reports WHERE id = '${r.id}'), '${now}'),
        '${now}'
      );

      INSERT OR IGNORE INTO members (id, category, name, profession, updated_at)
      VALUES ('${r.member_id}', 'その他', '${escName}', '', '${now}');
    `);
  });

  sqlLines.push('COMMIT;');

  const tmpFile = path.join(__dirname, '../temp_palms_sync.sql');
  fs.writeFileSync(tmpFile, sqlLines.join('\n'), 'utf8');
  try {
    execSync(`sqlite3 "${DB_FILE}" < "${tmpFile}"`);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    return records.length;
  } catch (err) {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    throw new Error('SQLite exec error: ' + err.message);
  }
}

async function main() {
  logMessage('=== BNI Connect PALMS Fetcher Started (Node.js) ===');

  const args = process.argv.slice(2);
  let startDate = null;
  let endDate = null;

  for (const arg of args) {
    if (arg.startsWith('--start=')) startDate = arg.split('=')[1];
    if (arg.startsWith('--end=')) endDate = arg.split('=')[1];
    if (arg === '--term=1') { startDate = '10/01/2025'; endDate = '03/31/2026'; }
    if (arg === '--term=2') { startDate = '04/01/2026'; endDate = '09/30/2026'; }
    if (arg === '--help') {
      console.log('Usage: node scripts/fetch_bni_connect_palms.js [--start=MM/DD/YYYY --end=MM/DD/YYYY] [--term=1|2]');
      process.exit(0);
    }
  }

  if (!startDate || !endDate) {
    const range = getDefaultWeeklyRange();
    startDate = range.startDate;
    endDate = range.endDate;
  }

  logMessage(`Target Date Range: ${startDate} -> ${endDate}`);

  try {
    logMessage('Step 1: Authenticating with BNI Connect API...');
    const tokens = await authenticate();
    logMessage('Step 2: Establishing Spring Security Web Session...');
    const cookie = await establishWebSession(tokens);
    logMessage('Step 3: Fetching PALMS report table...');
    const html = await fetchPalmsReportHtml(cookie, startDate, endDate);
    logMessage('Step 4: Parsing PALMS tabular data...');
    const records = parsePalmsHtml(html, startDate, endDate);
    logMessage(`Found ${records.length} member PALMS records.`);
    logMessage('Step 5: Persisting into SQLite database...');
    const saved = savePalmsToDb(records);
    logMessage(`Successfully saved ${saved} PALMS records to database.`);
    logMessage('=== BNI Connect PALMS Fetcher Finished Successfully ===');
  } catch (err) {
    logMessage('CRITICAL ERROR: ' + err.message);
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getDefaultWeeklyRange,
  toIsoDate,
  parsePalmsHtml,
  authenticate,
  establishWebSession,
  fetchPalmsReportHtml,
  savePalmsToDb
};
