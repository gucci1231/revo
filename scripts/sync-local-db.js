const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const SPREADSHEET_ID = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';
const DB_FILE = path.join(__dirname, '../api/data/database.sqlite');

function fetchSheetCsv(sheetName) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return resolve([]);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(parseCsv(data));
      });
    }).on('error', err => resolve([]));
  });
}

function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  const result = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      if (header[c]) {
        obj[header[c]] = row[c] !== undefined ? row[c] : '';
      }
    }
    result.push(obj);
  }
  return result;
}

function runSql(sql) {
  const tmpFile = path.join(__dirname, 'temp.sql');
  fs.writeFileSync(tmpFile, sql, 'utf8');
  try {
    execSync(`sqlite3 "${DB_FILE}" < "${tmpFile}"`);
  } catch (err) {
    console.error("SQL Error:", err.message);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

async function syncLocalDb() {
  console.log("🔄 Synchronizing local SQLite database with Google Sheets...");

  const initSql = `
    CREATE TABLE IF NOT EXISTS visitors (
        id TEXT PRIMARY KEY,
        created_at TEXT,
        inviter TEXT,
        event_date TEXT,
        visitor_name TEXT,
        furigana TEXT,
        profession TEXT,
        company TEXT,
        email TEXT,
        attendance_count TEXT DEFAULT '初めて',
        remarks TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS visitors_status (
        visitor_id TEXT PRIMARY KEY,
        is_attended TEXT DEFAULT '未',
        is_joined TEXT DEFAULT '未',
        is_1to1 TEXT DEFAULT '未',
        is_matched TEXT DEFAULT '未',
        matching_note TEXT DEFAULT '',
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS hearing_sheets (
        visitor_id TEXT PRIMARY KEY,
        orient_user TEXT DEFAULT '',
        q1 TEXT DEFAULT '', q2 TEXT DEFAULT '', q3 TEXT DEFAULT '',
        q4 TEXT DEFAULT '', q5 TEXT DEFAULT '', q6 TEXT DEFAULT '', q7 TEXT DEFAULT '',
        feel_abc TEXT DEFAULT '', orient_memo TEXT DEFAULT '', follow_memo TEXT DEFAULT '',
        sheet_url TEXT DEFAULT '', updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, category TEXT DEFAULT 'その他', name TEXT, profession TEXT DEFAULT '', updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT, updated_at TEXT
    );
  `;
  runSql(initSql);

  const visitors = await fetchSheetCsv('visitors');
  const status = await fetchSheetCsv('visitors_status');
  const hearings = await fetchSheetCsv('hearing_sheets');
  const members = await fetchSheetCsv('members');

  console.log(`Fetched: ${visitors.length} visitors, ${status.length} status, ${hearings.length} hearings, ${members.length} members`);

  let statements = ["BEGIN TRANSACTION;"];

  visitors.forEach(v => {
    if (!v.id) return;
    const esc = str => (str || '').replace(/'/g, "''");
    statements.push(`INSERT OR REPLACE INTO visitors VALUES ('${esc(v.id)}', '${esc(v.created_at)}', '${esc(v.inviter)}', '${esc(v.event_date)}', '${esc(v.visitor_name)}', '${esc(v.furigana)}', '${esc(v.profession)}', '${esc(v.company)}', '${esc(v.email)}', '${esc(v.attendance_count || '初めて')}', '${esc(v.remarks)}');`);
  });

  status.forEach(s => {
    if (!s.visitor_id) return;
    const esc = str => (str || '').replace(/'/g, "''");
    statements.push(`INSERT OR REPLACE INTO visitors_status VALUES ('${esc(s.visitor_id)}', '${esc(s.is_attended || '未')}', '${esc(s.is_joined || '未')}', '${esc(s.is_1to1 || '未')}', '${esc(s.is_matched || '未')}', '${esc(s.matching_note || '')}', '${esc(s.updated_at || '')}');`);
  });

  hearings.forEach(h => {
    if (!h.visitor_id) return;
    const esc = str => (str || '').replace(/'/g, "''");
    statements.push(`INSERT OR REPLACE INTO hearing_sheets VALUES ('${esc(h.visitor_id)}', '${esc(h.orient_user)}', '${esc(h.q1)}', '${esc(h.q2)}', '${esc(h.q3)}', '${esc(h.q4)}', '${esc(h.q5)}', '${esc(h.q6)}', '${esc(h.q7)}', '${esc(h.feel_abc)}', '${esc(h.orient_memo)}', '${esc(h.follow_memo)}', '${esc(h.sheet_url)}', '${esc(h.updated_at)}');`);
  });

  members.forEach(m => {
    if (!m.id) return;
    const esc = str => (str || '').replace(/'/g, "''");
    statements.push(`INSERT OR REPLACE INTO members VALUES ('${esc(m.id)}', '${esc(m.category || 'その他')}', '${esc(m.name)}', '${esc(m.profession)}', '${esc(m.updated_at)}');`);
  });

  statements.push("COMMIT;");
  runSql(statements.join("\n"));

  console.log("✅ Local SQLite database synced cleanly!");
}

syncLocalDb();
