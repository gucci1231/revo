const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const result = [];
  for (let line of lines) {
    const row = [];
    let inQuotes = false;
    let field = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i+1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(field);
        field = '';
      } else {
        field += c;
      }
    }
    row.push(field);
    result.push(row);
  }
  return result;
}

function cleanPhone(p) {
  if (!p) return '';
  let clean = p.replace(/[（\(][^）\)]*[）\)]/g, '').replace(/[^0-9\-+]/g, '').trim();
  clean = clean.replace(/^-+|-+$/g, '');
  return clean;
}

function normName(s) {
  return (s || '').replace(/[\s　]+/g, '').trim();
}

function normEmail(s) {
  return (s || '').toLowerCase().trim();
}

async function run() {
  const totalUrl = 'https://docs.google.com/spreadsheets/d/1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ/gviz/tq?tqx=out:csv&sheet=Total';
  const listUrl = 'https://docs.google.com/spreadsheets/d/1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ/gviz/tq?tqx=out:csv&sheet=List';
  
  console.log('Fetching Google Sheets CSVs...');
  const totalRows = parseCsv(await fetchCsv(totalUrl));
  const listRows = parseCsv(await fetchCsv(listUrl));
  
  const phoneMapByName = {};
  const phoneMapByEmail = {};

  // Total sheet
  const totalH = totalRows[0];
  const tNameIdx = totalH.indexOf('氏名');
  const tEmailIdx = totalH.indexOf('email');
  const tPhoneIdx = totalH.indexOf('連絡先');
  for (let i = 1; i < totalRows.length; i++) {
    const r = totalRows[i];
    const name = normName(r[tNameIdx]);
    const email = normEmail(r[tEmailIdx]);
    const phone = cleanPhone(r[tPhoneIdx]);
    if (phone) {
      if (email) phoneMapByEmail[email] = phone;
      if (name) phoneMapByName[name] = phone;
    }
  }

  // List sheet
  const listH = listRows[0];
  const lNameIdx = listH.indexOf('氏名');
  const lEmailIdx = listH.indexOf('メールアドレス');
  const lPhoneIdx = listH.indexOf('連絡先電話番号');
  for (let i = 1; i < listRows.length; i++) {
    const r = listRows[i];
    const name = normName(r[lNameIdx]);
    const email = normEmail(r[lEmailIdx]);
    const phone = cleanPhone(r[lPhoneIdx]);
    if (phone) {
      if (email) phoneMapByEmail[email] = phone;
      if (name) phoneMapByName[name] = phone;
    }
  }

  // SQLite database
  const dbPath = path.join(__dirname, '../api/data/database.sqlite');
  const dbDump = execSync(`/usr/bin/sqlite3 "${dbPath}" "SELECT id, visitor_name, email, remarks FROM visitors;"`, { encoding: 'utf8' });
  const visitors = dbDump.trim().split('\n').map(l => {
    const p = l.split('|');
    return { id: p[0], name: p[1], email: p[2], remarks: p[3] };
  });

  let updated = 0;
  const sqlStatements = [];
  for (const v of visitors) {
    const n = normName(v.name);
    const e = normEmail(v.email);
    let p = phoneMapByEmail[e] || phoneMapByName[n];
    if (!p && v.remarks && v.remarks.includes('TEL:')) {
      const m = v.remarks.match(/TEL:\s*([0-9\-]+)/);
      if (m) p = cleanPhone(m[1]);
    }
    if (p) {
      const escP = p.replace(/'/g, "''");
      const escId = v.id.replace(/'/g, "''");
      sqlStatements.push(`UPDATE visitors SET phone = '${escP}' WHERE id = '${escId}';`);
      updated++;
    }
  }

  console.log(`Found phone numbers for ${updated} visitors out of ${visitors.length}.`);
  const sqlFile = path.join(__dirname, '../scripts/update_phones.sql');
  const batchSql = "BEGIN TRANSACTION;\n" + sqlStatements.join("\n") + "\nCOMMIT;\n";
  fs.writeFileSync(sqlFile, batchSql, 'utf8');
  execSync(`/usr/bin/sqlite3 "${dbPath}" < "${sqlFile}"`);
  fs.unlinkSync(sqlFile);
  console.log(`✅ Successfully backfilled ${updated} visitor phone numbers in SQLite database!`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
