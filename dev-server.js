const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;
const SRC_DIR = path.join(__dirname, 'src');
const DB_FILE = path.join(__dirname, 'api/data/database.sqlite');

function runSqlJson(sql) {
  try {
    const tmpFile = path.join(__dirname, 'temp_query.sql');
    fs.writeFileSync(tmpFile, sql, 'utf8');
    const out = execSync(`sqlite3 -json "${DB_FILE}" < "${tmpFile}"`, { encoding: 'utf8' });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    return JSON.parse(out || '[]');
  } catch (err) {
    console.error('SQL Error:', err.message);
    return [];
  }
}

function runSqlExec(sql) {
  try {
    const tmpFile = path.join(__dirname, 'temp_exec.sql');
    fs.writeFileSync(tmpFile, sql, 'utf8');
    execSync(`sqlite3 "${DB_FILE}" < "${tmpFile}"`);
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    return true;
  } catch (err) {
    console.error('SQL Exec Error:', err.message);
    return false;
  }
}

function initDatabase() {
  runSqlExec(`
    CREATE TABLE IF NOT EXISTS chapter_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'チャプターイベント',
      start_datetime TEXT NOT NULL,
      end_datetime TEXT DEFAULT '',
      location_name TEXT DEFAULT '',
      location_url TEXT DEFAULT '',
      is_online INTEGER DEFAULT 0,
      organizer TEXT DEFAULT '',
      description TEXT DEFAULT '',
      recurrence_group_id TEXT DEFAULT '',
      recurrence_rule TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS meeting_customizations (
      meeting_date TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT '定例会',
      is_online INTEGER DEFAULT 0,
      location_name TEXT DEFAULT '',
      location_url TEXT DEFAULT '',
      start_datetime TEXT DEFAULT '',
      end_datetime TEXT DEFAULT '',
      organizer TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS region_events (
      id INTEGER PRIMARY KEY,
      event_id_enc TEXT,
      title TEXT NOT NULL,
      event_type_name TEXT,
      event_type_id INTEGER DEFAULT 0,
      event_category TEXT,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT,
      location_name TEXT,
      location_address TEXT,
      location_map_url TEXT,
      is_online INTEGER DEFAULT 0,
      cost_member TEXT,
      cost_visitor TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      max_attendees INTEGER DEFAULT 0,
      num_registered INTEGER DEFAULT 0,
      detail_url TEXT,
      registration_url TEXT,
      body_html TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  try { runSqlExec(`ALTER TABLE chapter_events ADD COLUMN recurrence_group_id TEXT DEFAULT '';`); } catch(e){}
  try { runSqlExec(`ALTER TABLE chapter_events ADD COLUMN recurrence_rule TEXT DEFAULT '';`); } catch(e){}

  // Seed default meeting customizations if not present
  try {
    const nowIso = new Date().toISOString().substring(0, 19).replace('T', ' ');
    runSqlExec(`
      INSERT OR IGNORE INTO meeting_customizations (meeting_date, title, category, is_online, location_name, location_url, start_datetime, end_datetime, organizer, description, created_at, updated_at)
      VALUES ('2026-10-22', 'モメンタム', 'モメンタム', 1, 'Zoom オンライン', '', '2026-10-22 06:00:00', '2026-10-22 08:30:00', 'REvoチャプター プレジデント & 運営チーム', '【モメンタム】定例会！チャプターの勢いを加速させる特別プログラム。\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会', '${nowIso}', '${nowIso}');

      INSERT OR IGNORE INTO meeting_customizations (meeting_date, title, category, is_online, location_name, location_url, start_datetime, end_datetime, organizer, description, created_at, updated_at)
      VALUES ('2026-11-05', 'BOD ONLINE', 'ビジネスオープンデー', 1, 'Zoom オンライン', '', '2026-11-05 06:00:00', '2026-11-05 08:30:00', 'REvoチャプター メンバー全員', '【BOD ONLINE】ビジネスオープンデー（オンラインZoom特別定例会）！\n多数のビジターをお招きしオンラインで開催。\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会', '${nowIso}', '${nowIso}');

      INSERT OR IGNORE INTO meeting_customizations (meeting_date, title, category, is_online, location_name, location_url, start_datetime, end_datetime, organizer, description, created_at, updated_at)
      VALUES ('2026-11-19', 'BOD 対面', 'ビジネスオープンデー', 0, 'スター食堂', '', '2026-11-19 06:00:00', '2026-11-19 08:30:00', 'REvoチャプター メンバー全員', '【BOD 対面】ビジネスオープンデー（対面リアル特別定例会）！\n会場: スター食堂\nメンバー 6:00 / ビジター 6:40受付開始 / 7:00開会 / 8:30閉会', '${nowIso}', '${nowIso}');

      UPDATE meeting_customizations SET is_online = 1, location_name = 'Zoom オンライン' WHERE (title = 'モメンタム' OR title LIKE '%通常%') AND (location_name LIKE '%通常定例会会場%' OR is_online = 0) AND meeting_date != '2026-11-19';
    `);
  } catch(e){}
}
initDatabase();

function buildHtml() {
  let indexContent = fs.readFileSync(path.join(SRC_DIR, 'Index.html'), 'utf8');

  // Replace <?!= include('FileName'); ?> with actual sub-template file contents
  indexContent = indexContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, filename) => {
    let filePath = path.join(SRC_DIR, filename + '.html');
    if (fs.existsSync(filePath)) {
      let subContent = fs.readFileSync(filePath, 'utf8');
      return subContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (m, fn) => {
        let fp = path.join(SRC_DIR, fn + '.html');
        return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
      });
    }
    return '';
  });

  // Inject Local Bridge script for google.script.run pointing to REST API endpoints
  const bridgeScript = `
  <script>
    if (typeof google === 'undefined') {
      window.google = {
        script: {
          history: { setChangeHandler: function() {} },
          host: { close: function() {} },
          run: {
            withSuccessHandler: function(cb) {
              this._successCb = cb;
              return this;
            },
            withFailureHandler: function(cb) {
              this._failCb = cb;
              return this;
            },
            getDashboardData: function() {
              fetch('/api/dashboard.php').then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            getAllVisitorsApi: function() {
              fetch('/api/visitors.php?action=list').then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            getHearingSheetsListApi: function() {
              fetch('/api/hearings.php?action=list').then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            getScheduledEmailsApi: function() {
              setTimeout(() => {
                if (this._successCb) this._successCb({ success: true, metrics: { totalCount: 0, todayCount: 0, thisWeekCount: 0 }, scheduledList: [] });
              }, 50);
            },
            getVisitorDetailApi: function(id) {
              fetch('/api/visitors.php?action=detail&id=' + id).then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            getMemberListApi: function() {
              fetch('/api/members.php?action=list').then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            getTrainingEventsApi: function(params) {
              const qs = params ? '?' + new URLSearchParams(params).toString() : '';
              fetch('/api/events.php?action=list' + qs).then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            syncTrainingEventsApi: function() {
              fetch('/api/events.php?action=sync', { method: 'POST' }).then(r=>r.json()).then(d=>this._successCb && this._successCb(d)).catch(e=>this._failCb && this._failCb(e));
            },
            logClientErrorApi: function() {}
          }
        }
      };
    }
  </script>
  `;

  return indexContent.replace('</head>', bridgeScript + '\n</head>');
}

function handleApiRequest(req, res, urlObj) {
  const pathname = urlObj.pathname;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    let input = {};
    try { if (body) input = JSON.parse(body); } catch(e){}

    const getDefaultGoals = () => {
      const row = runSqlJson("SELECT value FROM settings WHERE key = 'goals_default';")[0];
      const def = { target_joined: 2, target_visitors_weekly: 4, target_join_rate: 25.0, target_hearing_rate: 100.0 };
      if (row && row.value) {
        try { return { ...def, ...JSON.parse(row.value) }; } catch (e) {}
      }
      return def;
    };

    const getMonthlyGoalsMap = () => {
      const row = runSqlJson("SELECT value FROM settings WHERE key = 'goals_monthly';")[0];
      if (row && row.value) {
        try { return JSON.parse(row.value) || {}; } catch (e) {}
      }
      return {};
    };

    const resolveGoalsForMonth = (mStr) => {
      const norm = mStr.replace(/-/g, '/').trim();
      const def = getDefaultGoals();
      const map = getMonthlyGoalsMap();
      const resolved = {
        target_join_rate: def.target_join_rate || 25.0,
        target_hearing_rate: def.target_hearing_rate || 100.0,
        target_joined: def.target_joined || 2,
        target_visitors_weekly: def.target_visitors_weekly || 4,
        month: norm,
        source: 'default',
        is_custom: false
      };

      if (map[norm]) {
        resolved.target_joined = Number(map[norm].target_joined || def.target_joined);
        resolved.target_visitors_weekly = Number(map[norm].target_visitors_weekly || def.target_visitors_weekly);
        resolved.source = 'custom';
        resolved.is_custom = true;
        return resolved;
      }
      const past = Object.keys(map).filter(k => k < norm).sort().reverse();
      if (past.length > 0) {
        resolved.target_joined = Number(map[past[0]].target_joined || def.target_joined);
        resolved.target_visitors_weekly = Number(map[past[0]].target_visitors_weekly || def.target_visitors_weekly);
        resolved.source = 'inherited';
        resolved.inherited_from = past[0];
        resolved.is_custom = false;
        return resolved;
      }
      return resolved;
    };

    if (pathname === '/api/visitors.php') {
      const action = urlObj.searchParams.get('action') || input.action || 'list';
      if (action === 'list') {
        const sql = `
          SELECT 
              v.id, v.created_at as createdDate, COALESCE(v.inviter, '') as inviter, v.event_date as eventDate, 
              COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name, 
              COALESCE(v.furigana, '') as furigana, 
              COALESCE(v.profession, '') as profession, 
              COALESCE(v.company, '') as company, 
              COALESCE(v.email, '') as email, 
              COALESCE(v.phone, '') as phone,
              v.attendance_count as attendanceCount, v.remarks,
              COALESCE(v.category, 'ビジター') as category,
              COALESCE(s.is_attended, '未') as isAttended,
              COALESCE(s.is_joined, '未') as isJoined,
              COALESCE(s.is_1to1, '未') as is1to1,
              COALESCE(s.is_matched, '未') as matching,
              CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet,
              COALESCE(h.sheet_url, '') as hearingUrl,
              COALESCE(h.feel_abc, '') as feelAbc,
              COALESCE(h.q7, '') as q7,
              COALESCE(h.orient_user, '') as orientUser,
              COALESCE(h.orient_memo, '') as orientMemo
          FROM visitors v
          LEFT JOIN visitors_status s ON v.id = s.visitor_id
          LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
          ORDER BY v.event_date DESC;
        `;
        const list = runSqlJson(sql);
        return res.end(JSON.stringify({ success: true, list: list }));
      }

      if (action === 'detail') {
        const id = urlObj.searchParams.get('id') || input.id || '';
        const vSql = `SELECT * FROM visitors WHERE id = '${id.replace(/'/g, "''")}';`;
        const v = runSqlJson(vSql)[0] || null;
        if (!v) return res.end(JSON.stringify({ success: false, message: 'Visitor not found' }));

        // Linked IDs (同一人物判定)
        const cleanName = (v.visitor_name || '').replace(/[\s\u3000]+/g, '');
        const email = (v.email || '').trim();
        let linkedConditions = [`id = '${id.replace(/'/g, "''")}'`];
        if (email) linkedConditions.push(`LOWER(TRIM(email)) = '${email.toLowerCase().replace(/'/g, "''")}'`);
        if (cleanName && cleanName.length > 1 && !/^ビジター\s*(no\.?\s*\d+)?$/i.test(v.visitor_name)) {
          linkedConditions.push(`REPLACE(REPLACE(visitor_name, ' ', ''), '　', '') = '${cleanName.replace(/'/g, "''")}'`);
        }
        const linkedRows = runSqlJson(`SELECT id FROM visitors WHERE ${linkedConditions.join(' OR ')};`);
        const linkedIds = [...new Set(linkedRows.map(r => String(r.id)))];
        const placeholders = linkedIds.map(lid => `'${lid.replace(/'/g, "''")}'`).join(',');

        const visitsSql = `
          SELECT 
            v.id, v.created_at as createdAt, COALESCE(v.inviter, '') as inviter, COALESCE(v.event_date, '') as eventDate,
            COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name,
            COALESCE(v.furigana, '') as furigana, COALESCE(v.profession, '') as profession, COALESCE(v.company, '') as company,
            COALESCE(v.email, '') as email, COALESCE(v.phone, '') as phone, COALESCE(v.attendance_count, '初めて') as attendanceCount, COALESCE(v.remarks, '') as remarks,
            COALESCE(v.category, 'ビジター') as category,
            COALESCE(s.is_attended, '未') as isAttended, COALESCE(s.is_joined, '未') as isJoined, COALESCE(s.is_1to1, '未') as is1to1, COALESCE(s.is_matched, '未') as matching
          FROM visitors v
          LEFT JOIN visitors_status s ON v.id = s.visitor_id
          WHERE v.id IN (${placeholders})
          ORDER BY v.event_date ASC, CAST(v.id AS INTEGER) ASC;
        `;
        const visits = runSqlJson(visitsSql);

        const sSql = `SELECT * FROM visitors_status WHERE visitor_id IN (${placeholders}) ORDER BY updated_at DESC;`;
        const sRows = runSqlJson(sSql);
        const s = sRows[0] || { is_attended: '未', is_joined: '未', is_1to1: '未', is_matched: '未' };
        sRows.forEach(sr => {
          if (sr.is_attended === '参加') s.is_attended = '参加';
          if (sr.is_joined === '入会済' || sr.is_joined === '済') s.is_joined = '入会済';
          if (sr.is_1to1 === '済') s.is_1to1 = '済';
          if (sr.is_matched === '成功') s.is_matched = '成功';
        });

        const hSql = `
          SELECT 
            h.visitor_id as visitorId, 
            COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || h.visitor_id) as name, 
            COALESCE(v.company, '') as company, COALESCE(v.profession, '') as profession, COALESCE(v.inviter, '') as inviter, 
            COALESCE(v.event_date, '') as eventDate, COALESCE(v.attendance_count, '初めて') as attendanceCount,
            h.orient_user as orientUser, h.q1, h.q2, h.q3, h.q4, h.q5, h.q6, h.q7, h.feel_abc as feelAbc,
            h.orient_memo as orientMemo, h.follow_memo as followMemo, h.sheet_url as sheetUrl, h.updated_at as updatedAt,
            COALESCE(st.is_attended, '未') as isAttended, COALESCE(st.is_joined, '未') as isJoined, COALESCE(st.is_1to1, '未') as is1to1
          FROM hearing_sheets h
          LEFT JOIN visitors v ON h.visitor_id = v.id
          LEFT JOIN visitors_status st ON h.visitor_id = st.visitor_id
          WHERE h.visitor_id IN (${placeholders})
          ORDER BY v.event_date ASC, CAST(h.visitor_id AS INTEGER) ASC;
        `;
        const allHearings = runSqlJson(hSql);

        const apSql = `
          SELECT ap.*, 
                 COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
                 COALESCE(v.company, '') as visitor_company, 
                 COALESCE(v.profession, '') as visitor_profession, 
                 COALESCE(v.inviter, '') as visitor_inviter, 
                 COALESCE(v.event_date, '') as visitor_event_date,
                 COALESCE(v.attendance_count, '初めて') as visitor_attendance_count
          FROM action_plans ap
          LEFT JOIN visitors v ON ap.visitor_id = v.id
          WHERE ap.visitor_id IN (${placeholders})
          ORDER BY ap.is_completed ASC, ap.due_date ASC, ap.created_at DESC;
        `;
        const actionPlans = runSqlJson(apSql);
        const mSql = `SELECT id, category, name, profession FROM members ORDER BY category, name;`;
        const members = runSqlJson(mSql);

        const catMap = {};
        members.forEach(m => {
          const cat = m.category || 'その他';
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push({ id: m.id, name: m.name, profession: m.profession });
        });
        const memberCategories = Object.keys(catMap).map(c => ({ category: c, members: catMap[c] }));

        let directHearing = allHearings.find(h => String(h.visitorId) === String(id)) || null;
        let fallbackHearing = directHearing || (allHearings.length > 0 ? allHearings[allHearings.length - 1] : null);

        return res.end(JSON.stringify({
          success: true,
          visitor: {
            id: v.id, createdAt: v.created_at, inviter: v.inviter, eventDate: v.event_date,
            name: v.visitor_name, furigana: v.furigana, profession: v.profession, company: v.company,
            email: v.email, phone: v.phone || '', attendanceCount: v.attendance_count, remarks: v.remarks,
            category: v.category || 'ビジター',
            allIds: linkedIds, visitCount: visits.length
          },
          visits: visits,
          status: {
            isAttended: s.is_attended || '未', isJoined: s.is_joined || '未', is1to1: s.is_1to1 || '未', matching: s.is_matched || '未'
          },
          hearing: fallbackHearing,
          currentHearing: directHearing,
          hearings: allHearings,
          actionPlans: actionPlans,
          memberCategories: memberCategories,
          mailLogs: []
        }));
      }

      if (action === 'update_status') {
        const vId = (input.visitorId || '').replace(/'/g, "''");
        const colMap = { isAttended: 'is_attended', isJoined: 'is_joined', is1to1: 'is_1to1', matching: 'is_matched' };
        const col = colMap[input.field];
        if (col && vId) {
          const val = (input.value || '').replace(/'/g, "''");
          const sql = `INSERT INTO visitors_status (visitor_id, ${col}, updated_at) VALUES ('${vId}', '${val}', datetime('now')) ON CONFLICT(visitor_id) DO UPDATE SET ${col} = '${val}', updated_at = datetime('now');`;
          runSqlExec(sql);
        }
        return res.end(JSON.stringify({ success: true, visitorId: input.visitorId }));
      }

      if (action === 'add') {
        const esc = s => (s || '').toString().replace(/'/g, "''");
        const id = esc(input.id || '');
        const name = esc(input.name || '');
        const furigana = esc(input.furigana || '');
        const eventDate = esc(input.eventDate || '');
        const inviter = esc(input.inviter || '');
        const profession = esc(input.profession || '');
        const company = esc(input.company || '');
        const email = esc(input.email || '');
        const phone = esc(input.phone || '');
        const attendanceCount = esc(input.attendanceCount || '初めて');
        const category = esc(input.category || 'ビジター');

        if (id) {
          runSqlExec(`UPDATE visitors SET inviter='${inviter}', event_date='${eventDate}', visitor_name='${name}', furigana='${furigana}', profession='${profession}', company='${company}', email='${email}', phone='${phone}', attendance_count='${attendanceCount}', category='${category}' WHERE id='${id}';`);
          return res.end(JSON.stringify({ success: true, visitorId: id }));
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 16).replace(/-/g, '/');
        const maxIdRes = runSqlJson(`SELECT MAX(CAST(id AS INTEGER)) as max_id FROM visitors;`);
        const nextId = (parseInt(maxIdRes[0]?.max_id || 0, 10) + 1).toString();
        runSqlExec(`INSERT INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, phone, attendance_count, remarks, category) VALUES ('${nextId}', '${now}', '${inviter}', '${eventDate}', '${name}', '${furigana}', '${profession}', '${company}', '${email}', '${phone}', '${attendanceCount}', '', '${category}');`);
        runSqlExec(`INSERT INTO visitors_status (visitor_id, updated_at) VALUES ('${nextId}', '${now}');`);
        return res.end(JSON.stringify({ success: true, visitorId: nextId }));
      }
    }

    if (pathname === '/api/hearings.php') {
      const action = urlObj.searchParams.get('action') || input.action || 'list';
      if (action === 'list') {
        const sql = `
          SELECT 
              h.visitor_id as visitorId, 
              COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || h.visitor_id) as name, 
              COALESCE(v.company, '') as company, 
              COALESCE(v.profession, '') as profession, 
              COALESCE(v.inviter, '') as inviter, 
              COALESCE(NULLIF(v.event_date, ''), h.updated_at) as eventDate,
              h.orient_user as orientUser, h.q1, h.q2, h.q3, h.q4, h.q5, h.q6, h.q7, h.feel_abc as feelAbc,
              h.orient_memo as orientMemo, h.follow_memo as followMemo, h.sheet_url as sheetUrl, h.updated_at as updatedAt,
              COALESCE(s.is_attended, '未') as isAttended, COALESCE(s.is_joined, '未') as isJoined, COALESCE(s.is_1to1, '未') as is1to1
          FROM hearing_sheets h
          LEFT JOIN visitors v ON h.visitor_id = v.id
          LEFT JOIN visitors_status s ON h.visitor_id = s.visitor_id
          ORDER BY h.updated_at DESC;
        `;
        const list = runSqlJson(sql);
        return res.end(JSON.stringify({ success: true, list: list }));
      }

      if (action === 'get') {
        const vId = urlObj.searchParams.get('visitorId') || input.visitorId || '';
        const vSql = `SELECT visitor_name, inviter, company, profession, event_date FROM visitors WHERE id = '${vId.replace(/'/g, "''")}';`;
        const hSql = `SELECT * FROM hearing_sheets WHERE visitor_id = '${vId.replace(/'/g, "''")}';`;

        const vInfoRaw = runSqlJson(vSql)[0] || {};
        const h = runSqlJson(hSql)[0] || {};

        const vInfo = {
          visitor_name: vInfoRaw.visitor_name || '',
          inviter: vInfoRaw.inviter || '',
          company: vInfoRaw.company || '',
          profession: vInfoRaw.profession || '',
          event_date: vInfoRaw.event_date || ''
        };

        const formData = {
          visitorId: vId,
          orientUser: h.orient_user || '',
          q1: h.q1 || '', q2: h.q2 || '', q3: h.q3 || '',
          q4: h.q4 || '', q5: h.q5 || '', q6: h.q6 || '', q7: h.q7 || '',
          feelAbc: h.feel_abc || '',
          orientMemo: h.orient_memo || '',
          followMemo: h.follow_memo || '',
          sheetUrl: h.sheet_url || ''
        };

        const mSql = `SELECT id, category, name, profession FROM members ORDER BY category, name;`;
        const members = runSqlJson(mSql);
        const catMap = {};
        members.forEach(m => {
          const cat = m.category || 'その他';
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push({ id: m.id, name: m.name, profession: m.profession });
        });
        const memberCategories = Object.keys(catMap).map(c => ({ category: c, members: catMap[c] }));

        return res.end(JSON.stringify({
          success: true,
          visitorInfo: vInfo,
          formData: formData,
          memberCategories: memberCategories
        }));
      }

      if (action === 'save') {
        const vId = (input.visitorId || '').replace(/'/g, "''");
        if (!vId) return res.end(JSON.stringify({ success: false, message: 'visitorId is required' }));

        const esc = s => (s || '').toString().replace(/'/g, "''");
        const orientUser = esc(input.orientUser || input.orient_user);
        const q1 = esc(input.q1); const q2 = esc(input.q2); const q3 = esc(input.q3);
        const q4 = esc(input.q4); const q5 = esc(input.q5); const q6 = esc(input.q6); const q7 = esc(input.q7);
        const feelAbc = esc(input.feelAbc || input.feel_abc);
        const orientMemo = esc(input.orientMemo || input.orient_memo);
        const followMemo = esc(input.followMemo || input.follow_memo);
        const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

        const sql = `
          INSERT INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, updated_at)
          VALUES ('${vId}', '${orientUser}', '${q1}', '${q2}', '${q3}', '${q4}', '${q5}', '${q6}', '${q7}', '${feelAbc}', '${orientMemo}', '${followMemo}', '${now}')
          ON CONFLICT(visitor_id) DO UPDATE SET
            orient_user = '${orientUser}', q1 = '${q1}', q2 = '${q2}', q3 = '${q3}', q4 = '${q4}', q5 = '${q5}', q6 = '${q6}', q7 = '${q7}',
            feel_abc = '${feelAbc}', orient_memo = '${orientMemo}', follow_memo = '${followMemo}', updated_at = '${now}';
        `;
        runSqlExec(sql);
        return res.end(JSON.stringify({ success: true, visitorId: input.visitorId }));
      }
    }

    if (pathname === '/api/action_plans.php') {
      const action = urlObj.searchParams.get('action') || input.action || 'list';
      const esc = s => (s || '').toString().replace(/'/g, "''");

      // 完了してから1週間（7日）経過した完了実績アクションプランを削除
      const purgeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      runSqlExec(`
        DELETE FROM action_plans
        WHERE is_completed = 1
          AND (
            (completed_at IS NOT NULL AND completed_at != '' AND completed_at < '${purgeThreshold}')
            OR ((completed_at IS NULL OR completed_at = '') AND updated_at < '${purgeThreshold}')
          );
      `);

      if (action === 'list') {
        const vId = esc(urlObj.searchParams.get('visitorId') || input.visitorId || '');
        let sql = '';
        if (vId) {
          sql = `SELECT * FROM action_plans WHERE visitor_id = '${vId}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`;
        } else {
          sql = `
            SELECT ap.*, 
                   COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
                   COALESCE(v.company, '') as visitor_company, 
                   COALESCE(v.profession, '') as visitor_profession, 
                   COALESCE(v.inviter, '') as visitor_inviter, 
                   COALESCE(v.event_date, '') as visitor_event_date
            FROM action_plans ap
            LEFT JOIN visitors v ON ap.visitor_id = v.id
            ORDER BY ap.is_completed ASC, ap.due_date ASC, ap.created_at DESC
            LIMIT 300;
          `;
        }
        const list = runSqlJson(sql);
        return res.end(JSON.stringify({ success: true, visitorId: vId, list: list }));
      }

      if (action === 'detail') {
        const id = esc(urlObj.searchParams.get('id') || input.id || '');
        const sql = `
          SELECT ap.*, 
                 COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
                 COALESCE(v.company, '') as visitor_company, 
                 COALESCE(v.profession, '') as visitor_profession, 
                 COALESCE(v.inviter, '') as visitor_inviter, 
                 COALESCE(v.event_date, '') as visitor_event_date
          FROM action_plans ap
          LEFT JOIN visitors v ON ap.visitor_id = v.id
          WHERE ap.id = '${id}';
        `;
        const item = runSqlJson(sql)[0] || null;
        if (!item) return res.end(JSON.stringify({ success: false, message: 'Not found' }));
        return res.end(JSON.stringify({ success: true, id: id, item: item }));
      }

      if (action === 'create' || action === 'add') {
        const vId = esc(input.visitorId || input.visitor_id || '');
        const actionText = esc(input.actionText || input.action_text || '');
        if (!vId || !actionText) {
          return res.end(JSON.stringify({ success: false, message: 'visitorId and actionText are required' }));
        }
        const id = 'ap_' + Math.random().toString(36).substring(2, 10);
        const dueDate = esc(input.dueDate || input.due_date || '');
        const assigneeName = esc(input.assigneeName || input.assignee_name || '');
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const sql = `
          INSERT INTO action_plans (id, visitor_id, due_date, assignee_name, assignee_id, action_text, is_completed, completed_at, created_at, updated_at)
          VALUES ('${id}', '${vId}', '${dueDate}', '${assigneeName}', '', '${actionText}', 0, '', '${now}', '${now}');
        `;
        runSqlExec(sql);
        const listSql = `SELECT * FROM action_plans WHERE visitor_id = '${vId}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`;
        const list = runSqlJson(listSql);
        return res.end(JSON.stringify({ success: true, id: id, list: list }));
      }

      if (action === 'update') {
        const id = esc(input.id || '');
        if (!id) return res.end(JSON.stringify({ success: false, message: 'id is required' }));

        const dueDate = esc(input.dueDate || input.due_date || '');
        const assigneeName = esc(input.assigneeName || input.assignee_name || '');
        const actionText = esc(input.actionText || input.action_text || '');
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const curItem = runSqlJson(`SELECT * FROM action_plans WHERE id = '${id}';`)[0] || null;
        if (!curItem) return res.end(JSON.stringify({ success: false, message: 'Not found' }));

        const isCompleted = input.isCompleted !== undefined ? Number(input.isCompleted) : curItem.is_completed;
        const completedAt = isCompleted === 1 ? now : '';

        const sql = `
          UPDATE action_plans SET
            due_date = '${dueDate}',
            assignee_name = '${assigneeName}',
            action_text = '${actionText}',
            is_completed = ${isCompleted},
            completed_at = '${completedAt}',
            updated_at = '${now}'
          WHERE id = '${id}';
        `;
        runSqlExec(sql);
        const list = runSqlJson(`SELECT * FROM action_plans WHERE visitor_id = '${curItem.visitor_id}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`);
        return res.end(JSON.stringify({ success: true, id: id, list: list }));
      }

      if (action === 'toggle') {
        const id = esc(input.id || '');
        const curItem = runSqlJson(`SELECT * FROM action_plans WHERE id = '${id}';`)[0] || null;
        if (!curItem) return res.end(JSON.stringify({ success: false, message: 'Not found' }));

        const newStatus = input.isCompleted !== undefined ? Number(input.isCompleted) : (Number(curItem.is_completed) === 1 ? 0 : 1);
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const completedAt = newStatus === 1 ? now : '';

        const sql = `
          UPDATE action_plans SET
            is_completed = ${newStatus},
            completed_at = '${completedAt}',
            updated_at = '${now}'
          WHERE id = '${id}';
        `;
        runSqlExec(sql);
        const list = runSqlJson(`SELECT * FROM action_plans WHERE visitor_id = '${curItem.visitor_id}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`);
        return res.end(JSON.stringify({ success: true, id: id, list: list }));
      }

      if (action === 'report') {
        const id = esc(input.id || '');
        const curItem = runSqlJson(`SELECT * FROM action_plans WHERE id = '${id}';`)[0] || null;
        if (!curItem) return res.end(JSON.stringify({ success: false, message: 'Not found' }));

        const reportText = esc(input.reportText || input.report_text || '');
        const reporterName = esc(input.reporterName || input.reporter_name || '');
        const markCompleted = input.isCompleted !== undefined ? (Number(input.isCompleted) === 1) : true;
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const isCompleted = markCompleted ? 1 : Number(curItem.is_completed);
        const completedAt = isCompleted === 1 ? (curItem.completed_at || now) : '';

        const sql = `
          UPDATE action_plans SET
            report_text = '${reportText}',
            reporter_name = '${reporterName}',
            completed_by = '${reporterName}',
            is_completed = ${isCompleted},
            completed_at = '${completedAt}',
            updated_at = '${now}'
          WHERE id = '${id}';
        `;
        runSqlExec(sql);
        const list = runSqlJson(`SELECT * FROM action_plans WHERE visitor_id = '${curItem.visitor_id}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`);
        const item = runSqlJson(`SELECT * FROM action_plans WHERE id = '${id}';`)[0] || null;
        return res.end(JSON.stringify({ success: true, id: id, item: item, list: list }));
      }

      if (action === 'delete') {
        const id = esc(input.id || '');
        const vId = esc(input.visitorId || '');
        const curItem = runSqlJson(`SELECT * FROM action_plans WHERE id = '${id}';`)[0] || null;
        const targetVId = vId || (curItem ? curItem.visitor_id : '');

        runSqlExec(`DELETE FROM action_plans WHERE id = '${id}';`);
        const list = targetVId ? runSqlJson(`SELECT * FROM action_plans WHERE visitor_id = '${targetVId}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`) : [];
        return res.end(JSON.stringify({ success: true, id: id, list: list }));
      }
    }

    if (pathname === '/api/settings.php') {
      const action = urlObj.searchParams.get('action') || (input ? input.action : 'get');

      if (action === 'get') {
        const rows = runSqlJson("SELECT key, value FROM settings;");
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        return res.end(JSON.stringify({ success: true, settings: settings }));
      }

      if (action === 'update') {
        const key = esc(input.key || '');
        const val = esc(input.value || '');
        const now = new Date().toISOString();
        runSqlExec(`INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${val}', '${now}') ON CONFLICT(key) DO UPDATE SET value = '${val}', updated_at = '${now}';`);
        return res.end(JSON.stringify({ success: true, key: key, value: val }));
      }

      if (action === 'get_goals') {
        const defaultGoals = getDefaultGoals();
        const monthlyMap = getMonthlyGoalsMap();
        const currentMonth = new Date().toISOString().substring(0, 7).replace('-', '/');
        const monthsPreview = [];
        const nowD = new Date();
        nowD.setDate(1);
        nowD.setMonth(nowD.getMonth() - 2);
        for (let i = 0; i < 12; i++) {
          const ym = nowD.toISOString().substring(0, 7).replace('-', '/');
          monthsPreview.push(resolveGoalsForMonth(ym));
          nowD.setMonth(nowD.getMonth() + 1);
        }
        return res.end(JSON.stringify({
          success: true,
          defaultGoals: defaultGoals,
          monthlyMap: monthlyMap,
          monthsPreview: monthsPreview,
          currentMonth: currentMonth
        }));
      }

      if (action === 'save_default_goals') {
        const goals = input.goals || {};
        const clean = {
          target_joined: Number(goals.target_joined || 2),
          target_visitors_weekly: Number(goals.target_visitors_weekly || 4),
          target_join_rate: Number(goals.target_join_rate || 25.0),
          target_hearing_rate: Number(goals.target_hearing_rate || 100.0)
        };
        const val = esc(JSON.stringify(clean));
        const now = new Date().toISOString();
        runSqlExec(`INSERT INTO settings (key, value, updated_at) VALUES ('goals_default', '${val}', '${now}') ON CONFLICT(key) DO UPDATE SET value = '${val}', updated_at = '${now}';`);
        return res.end(JSON.stringify({ success: true, defaultGoals: clean }));
      }

      if (action === 'save_monthly_goal') {
        const m = (input.month || '').replace(/-/g, '/').trim();
        const goals = input.goals || {};
        const clean = {
          target_joined: Number(goals.target_joined || 2),
          target_visitors_weekly: Number(goals.target_visitors_weekly || 4)
        };
        const map = getMonthlyGoalsMap();
        map[m] = clean;
        const val = esc(JSON.stringify(map));
        const now = new Date().toISOString();
        runSqlExec(`INSERT INTO settings (key, value, updated_at) VALUES ('goals_monthly', '${val}', '${now}') ON CONFLICT(key) DO UPDATE SET value = '${val}', updated_at = '${now}';`);
        return res.end(JSON.stringify({ success: true, month: m, goals: resolveGoalsForMonth(m), monthlyMap: map }));
      }

      if (action === 'delete_monthly_goal') {
        const m = (input.month || '').replace(/-/g, '/').trim();
        const map = getMonthlyGoalsMap();
        delete map[m];
        const val = esc(JSON.stringify(map));
        const now = new Date().toISOString();
        runSqlExec(`INSERT INTO settings (key, value, updated_at) VALUES ('goals_monthly', '${val}', '${now}') ON CONFLICT(key) DO UPDATE SET value = '${val}', updated_at = '${now}';`);
        return res.end(JSON.stringify({ success: true, month: m, goals: resolveGoalsForMonth(m), monthlyMap: map }));
      }
    }

    if (pathname === '/api/dashboard.php') {
      const sql = `
        SELECT 
            v.id, 
            COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name, 
            COALESCE(v.furigana, '') as furigana, 
            COALESCE(v.company, '') as company, 
            COALESCE(v.profession, '') as profession, 
            COALESCE(v.inviter, '') as inviter, 
            COALESCE(v.event_date, '') as eventDate,
            COALESCE(v.attendance_count, '初めて') as attendanceCount,
            COALESCE(s.is_attended, '未') as isAttended,
            COALESCE(s.is_joined, '未') as isJoined,
            COALESCE(s.is_1to1, '未') as is1to1,
            COALESCE(h.feel_abc, '') as feelAbc,
            COALESCE(h.q7, '') as q7,
            COALESCE(h.orient_user, '') as orientUser,
            COALESCE(h.orient_memo, '') as orientMemo,
            CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet
        FROM visitors v
        LEFT JOIN visitors_status s ON v.id = s.visitor_id
        LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
        ORDER BY v.event_date DESC, v.id DESC;
      `;
      const visitors = runSqlJson(sql);
      const totalApplyCount = visitors.length;
      let totalJoinedCount = 0;
      let totalAttendedCount = 0;
      let totalHearingCount = 0;
      const hotVisitors = [];
      const nextMeetingVisitors = [];
      const lastMeetingVisitors = [];
      const oneMonthFollowup = [];
      const weeklyMap = {};
      const monthlyMap = {};

      const startDateRow = runSqlJson("SELECT value FROM settings WHERE key = 'start_date';")[0];
      const startDateStr = (startDateRow && startDateRow.value) ? startDateRow.value : '2026/10/01';

      const apSql = `
        SELECT ap.*, 
               COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
               COALESCE(v.company, '') as visitor_company, 
               COALESCE(v.profession, '') as visitor_profession, 
               COALESCE(v.inviter, '') as visitor_inviter, 
               COALESCE(v.event_date, '') as visitor_event_date
        FROM action_plans ap
        LEFT JOIN visitors v ON ap.visitor_id = v.id
        ORDER BY ap.is_completed ASC, ap.due_date ASC, ap.created_at DESC
        LIMIT 100;
      `;
      const actionPlans = runSqlJson(apSql);
      const todayStr = new Date().toISOString().slice(0, 10);
      const apMap = {};
      let pendingApCount = 0;
      let overdueApCount = 0;
      actionPlans.forEach(ap => {
        const vId = String(ap.visitor_id);
        if (!apMap[vId]) {
          apMap[vId] = ap;
        } else if (Number(apMap[vId].is_completed) === 1 && Number(ap.is_completed) === 0) {
          apMap[vId] = ap;
        }

        if (Number(ap.is_completed) === 0) {
          pendingApCount++;
          if (ap.due_date && ap.due_date < todayStr) overdueApCount++;
        }
      });

      visitors.forEach(r => {
        r.latestActionPlan = apMap[String(r.id)] || null;
        const isJoinedBool = (r.isJoined === '入会済' || r.isJoined === '済' || r.isJoined === '入会');
        const isAttendedBool = (r.isAttended === '参加' || r.isAttended === '済');
        const isRejected = (r.isJoined === '見送り');

        if (isJoinedBool) totalJoinedCount++;
        if (isAttendedBool) totalAttendedCount++;
        if (r.hasHearingSheet) totalHearingCount++;

        const feel = (r.feelAbc || '').toUpperCase().trim();
        if (feel === 'A' && !isJoinedBool && !isRejected) {
          hotVisitors.push(r);
        }

        const eDate = (r.eventDate || '').trim();
        if (eDate !== '') {
          const eTs = new Date(eDate.replace(/\//g, '-')).getTime();
          const oneMonthAgoTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
          if (eTs && eTs >= oneMonthAgoTs && !isJoinedBool && !isRejected) {
            oneMonthFollowup.push(r);
          }

          if (!weeklyMap[eDate]) {
            weeklyMap[eDate] = {
              date: eDate,
              applyCount: 0,
              attendedCount: 0,
              joinedCount: 0,
              feelCounts: { A: 0, B: 0, C: 0, none: 0 }
            };
          }
          weeklyMap[eDate].applyCount++;
          if (isAttendedBool) weeklyMap[eDate].attendedCount++;
          if (isJoinedBool) weeklyMap[eDate].joinedCount++;
          if (feel === 'A' || feel === 'B' || feel === 'C') {
            weeklyMap[eDate].feelCounts[feel]++;
          } else {
            weeklyMap[eDate].feelCounts.none++;
          }

          const mKey = eDate.substring(0, 7);
          if (/^\d{4}[\/\-]\d{2}$/.test(mKey)) {
            if (!monthlyMap[mKey]) {
              monthlyMap[mKey] = {
                month: mKey,
                applyCount: 0,
                attendedCount: 0,
                joinedCount: 0,
                feelCounts: { A: 0, B: 0, C: 0, none: 0 }
              };
            }
            monthlyMap[mKey].applyCount++;
            if (isAttendedBool) monthlyMap[mKey].attendedCount++;
            if (isJoinedBool) monthlyMap[mKey].joinedCount++;
            if (feel === 'A' || feel === 'B' || feel === 'C') {
              monthlyMap[mKey].feelCounts[feel]++;
            } else {
              monthlyMap[mKey].feelCounts.none++;
            }
          }
        }
      });

      // 指定期間（startDate〜today）内の全木曜日（定例会開催日）を weeklyMap に事前登録
      const todayObj = new Date();
      let curD = new Date(startDateStr.replace(/\//g, '-'));
      if (isNaN(curD.getTime())) curD = new Date('2026-04-01');
      while (curD <= todayObj) {
        if (curD.getDay() === 4) { // 木曜日
          const y = curD.getFullYear();
          const m = String(curD.getMonth() + 1).padStart(2, '0');
          const d = String(curD.getDate()).padStart(2, '0');
          const dStr = `${y}/${m}/${d}`;
          if (!weeklyMap[dStr]) {
            weeklyMap[dStr] = {
              date: dStr,
              applyCount: 0,
              attendedCount: 0,
              joinedCount: 0,
              feelCounts: { A: 0, B: 0, C: 0, none: 0 }
            };
          }
        }
        curD.setDate(curD.getDate() + 1);
      }

      // 月ごとの定例会開催数（経過した木曜日数）を算出
      const monthlyMeetingCounts = {};
      Object.keys(monthlyMap).forEach(mKey => {
        const ymClean = mKey.replace(/\//g, '-');
        const firstDay = new Date(ymClean + '-01');
        const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
        const endDay = lastDay > todayObj ? todayObj : lastDay;

        let thuCount = 0;
        let cD = new Date(firstDay);
        while (cD <= endDay) {
          if (cD.getDay() === 4) thuCount++;
          cD.setDate(cD.getDate() + 1);
        }
        monthlyMeetingCounts[mKey] = Math.max(1, thuCount);
      });

      const weeklyKeys = Object.keys(weeklyMap).sort().reverse();
      const weeklyStats = weeklyKeys.map(k => {
        const w = weeklyMap[k];
        const total = w.applyCount;
        const feelRates = {
          A: total > 0 ? ((w.feelCounts.A / total) * 100).toFixed(1) + "%" : "0.0%",
          B: total > 0 ? ((w.feelCounts.B / total) * 100).toFixed(1) + "%" : "0.0%",
          C: total > 0 ? ((w.feelCounts.C / total) * 100).toFixed(1) + "%" : "0.0%"
        };
        const monthKey = k.substring(0, 7);
        const wGoal = resolveGoalsForMonth(monthKey);
        return {
          ...w,
          feelRates,
          targetVisitorsWeekly: wGoal.target_visitors_weekly || 4
        };
      });

      const monthlyKeys = Object.keys(monthlyMap).sort().reverse();
      const monthlyStats = monthlyKeys.map(k => {
        const m = monthlyMap[k];
        const total = m.applyCount;
        const rate = total > 0 ? ((m.joinedCount / total) * 100).toFixed(1) : "0.0";
        const feelRates = {
          A: total > 0 ? ((m.feelCounts.A / total) * 100).toFixed(1) + "%" : "0.0%",
          B: total > 0 ? ((m.feelCounts.B / total) * 100).toFixed(1) + "%" : "0.0%",
          C: total > 0 ? ((m.feelCounts.C / total) * 100).toFixed(1) + "%" : "0.0%"
        };
        const g = resolveGoalsForMonth(k);
        const monthWeeks = monthlyMeetingCounts[k] || Math.max(1, weeklyKeys.filter(wk => wk.startsWith(k)).length);
        const avgPerWeek = (total / Math.max(1, monthWeeks)).toFixed(1);
        return {
          ...m,
          joinRate: rate + "%",
          feelRates,
          goal: g,
          targetJoined: g.target_joined || 2,
          targetVisitorsWeekly: g.target_visitors_weekly || 4,
          avgVisitorsWeekly: avgPerWeek,
          meetingCount: monthWeeks,
          targetJoinRate: (g.target_join_rate || 25.0) + "%",
          targetHearingRate: (g.target_hearing_rate || 100.0) + "%",
          isCustomGoal: !!g.is_custom,
          goalSource: g.source || "default"
        };
      });

      const chartDatesAsc = Object.keys(weeklyMap).filter(d => d >= startDateStr).sort();
      const chartLabels = chartDatesAsc.map(d => d.substring(5));
      const chartData = chartDatesAsc.map(d => weeklyMap[d].applyCount);

      let totalMeetingThursdays = 0;
      let cTh = new Date(startDateStr.replace(/\//g, '-'));
      if (isNaN(cTh.getTime())) cTh = new Date('2026-04-01');
      while (cTh <= todayObj) {
        if (cTh.getDay() === 4) totalMeetingThursdays++;
        cTh.setDate(cTh.getDate() + 1);
      }
      const meetingCount = Math.max(1, totalMeetingThursdays);
      const avgVisitorCount = (totalApplyCount / meetingCount).toFixed(1);

      let targetJoinGoal = 0;
      let startD = new Date(startDateStr.replace(/\//g, '-'));
      if (isNaN(startD.getTime())) startD = new Date('2026-04-01');
      for (let i = 0; i < 6; i++) {
        const ym = startD.toISOString().substring(0, 7).replace('-', '/');
        const g = resolveGoalsForMonth(ym);
        targetJoinGoal += (g.target_joined || 2);
        startD.setMonth(startD.getMonth() + 1);
      }
      if (targetJoinGoal <= 0) targetJoinGoal = 12;

      const currentYm = new Date().toISOString().substring(0, 7).replace('-', '/');
      const currentMonthGoal = resolveGoalsForMonth(currentYm);
      const achievementRate = targetJoinGoal > 0 ? ((totalJoinedCount / targetJoinGoal) * 100).toFixed(1) : "0.0";

      return res.end(JSON.stringify({
        success: true,
        nextThuStr: "08/13",
        afterNextThuStr: "08/20",
        lastThuStr: "08/06",
        metrics: {
          applyCount: totalApplyCount,
          joinedCount: totalJoinedCount,
          targetJoinGoal: targetJoinGoal,
          achievementRate: achievementRate,
          joinRate: totalApplyCount > 0 ? ((totalJoinedCount / totalApplyCount) * 100).toFixed(1) : "0.0",
          nextThuCount: nextMeetingVisitors.length,
          afterNextThuCount: 0,
          avgVisitorCount: avgVisitorCount,
          feedbackRate: "85.0",
          hearingRate: totalApplyCount > 0 ? ((totalHearingCount / totalApplyCount) * 100).toFixed(1) : "0.0",
          hotVisitorCount: hotVisitors.length,
          pendingActionPlansCount: pendingApCount,
          overdueActionPlansCount: overdueApCount,
          currentMonth: currentYm,
          currentMonthGoal: currentMonthGoal
        },
        chart: { labels: chartLabels, data: chartData },
        tables: {
          actionPlans: actionPlans,
          hotVisitors: hotVisitors,
          nextMeeting: nextMeetingVisitors,
          lastMeeting: lastMeetingVisitors,
          oneMonthFollowup: oneMonthFollowup,
          weeklyStats: weeklyStats,
          monthlyStats: monthlyStats
        }
      }));
    }

    if (pathname === '/api/members.php') {
      const action = urlObj.searchParams.get('action') || input.action || 'list';
      const esc = s => (s || '').toString().replace(/'/g, "''");

      if (action === 'add') {
        const category = esc(input.category || 'その他');
        const name = esc(input.name || '');
        const profession = esc(input.profession || '');
        const status = esc(input.status || '在籍');
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const maxIdRes = runSqlJson(`SELECT MAX(CAST(id AS INTEGER)) as max_id FROM members;`);
        const nextId = (parseInt(maxIdRes[0]?.max_id || 0, 10) + 1).toString();
        runSqlExec(`INSERT INTO members (id, category, name, profession, status, updated_at) VALUES ('${nextId}', '${category}', '${name}', '${profession}', '${status}', '${now}');`);
      } else if (action === 'update') {
        const id = esc(input.id || '');
        const category = esc(input.category || 'その他');
        const name = esc(input.name || '');
        const profession = esc(input.profession || '');
        const status = esc(input.status || '在籍');
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        runSqlExec(`UPDATE members SET category = '${category}', name = '${name}', profession = '${profession}', status = '${status}', updated_at = '${now}' WHERE id = '${id}';`);
      } else if (action === 'delete') {
        const id = esc(input.id || urlObj.searchParams.get('id') || '');
        runSqlExec(`DELETE FROM members WHERE id = '${id}';`);
      }

      const sql = `SELECT id, category, name, profession, COALESCE(status, '在籍') as status FROM members ORDER BY CASE WHEN status = '退会' THEN 1 ELSE 0 END, category, name;`;
      const flatMembers = runSqlJson(sql);
      const categoriesMap = {};
      flatMembers.forEach(m => {
        const cat = m.category || 'その他';
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(m);
      });
      const memberCategories = Object.keys(categoriesMap).map(cat => ({ category: cat, members: categoriesMap[cat] }));
      return res.end(JSON.stringify({ success: true, memberCategories: memberCategories, flatMembers: flatMembers }));
    }

    if (pathname === '/api/palms.php') {
      const action = urlObj.searchParams.get('action') || (req.method === 'POST' ? 'sync' : 'list');
      
      if (action === 'member') {
        const memberName = urlObj.searchParams.get('name');
        const memberId = urlObj.searchParams.get('member_id');
        if (!memberName && !memberId) {
          res.writeHead(400);
          return res.end(JSON.stringify({ success: false, error: 'Member name or ID is required' }));
        }

        const safeVal = (memberId || memberName).replace(/'/g, "''");
        const where = memberId ? `p.member_id = '${safeVal}'` : `p.member_name = '${safeVal}'`;
        const sql = `
          SELECT 
            p.*,
            (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) as total_referrals_given,
            (p.rri_referrals_received_internal + p.rro_referrals_received_external) as total_referrals_received,
            (p.tyfcb_amount * 1000) as tyfcb_yen,
            m.category as member_category,
            m.profession as member_profession
          FROM palms_reports p
          LEFT JOIN (
            SELECT name, category, profession, status
            FROM (
              SELECT name, category, profession, status,
                     CASE WHEN category != 'その他' AND category != '' THEN 0 ELSE 1 END as priority
              FROM members
              ORDER BY priority ASC, id ASC
            )
            GROUP BY name
          ) m ON p.member_name = m.name
          WHERE ${where}
          GROUP BY p.id
          ORDER BY p.end_date DESC, p.start_date DESC;
        `;
        const history = runSqlJson(sql);
        const weekly = [];
        const terms = [];
        history.forEach(h => {
          const d1 = new Date(h.start_date);
          const d2 = new Date(h.end_date);
          const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
          if (diffDays <= 14) {
            weekly.push(h);
          } else {
            terms.push(h);
          }
        });

        return res.end(JSON.stringify({
          success: true,
          member: memberName || (history[0] ? history[0].member_name : ''),
          history: history,
          weekly: weekly,
          terms: terms
        }));
      }

      if (action === 'chapter_trends') {
        const sqlWeekly = `
          SELECT 
            start_date, end_date,
            SUM(p_present) as total_present,
            SUM(a_absent) as total_absent,
            SUM(l_late) as total_late,
            SUM(m_medical) as total_medical,
            SUM(s_substitute) as total_sub,
            SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
            SUM(rgi_referrals_given_internal) as total_referrals_internal,
            SUM(rgo_referrals_given_external) as total_referrals_external,
            SUM(one_to_ones) as total_oto,
            SUM(v_visitors) as total_visitors,
            SUM(ceu) as total_ceu,
            SUM(tyfcb_amount * 1000) as total_tyfcb,
            COUNT(DISTINCT member_id) as member_count
          FROM palms_reports
          WHERE (julianday(end_date) - julianday(start_date)) <= 14
          GROUP BY start_date, end_date
          ORDER BY end_date ASC;
        `;
        const weekly = runSqlJson(sqlWeekly);

        const sqlMonthly = `
          SELECT 
            strftime('%Y-%m', end_date) as month,
            MIN(start_date) as start_date,
            MAX(end_date) as end_date,
            COUNT(DISTINCT end_date) as week_count,
            MAX(member_count) as member_count,
            SUM(total_present) as total_present,
            SUM(total_absent) as total_absent,
            SUM(total_late) as total_late,
            SUM(total_medical) as total_medical,
            SUM(total_sub) as total_sub,
            SUM(total_referrals) as total_referrals,
            SUM(total_referrals_internal) as total_referrals_internal,
            SUM(total_referrals_external) as total_referrals_external,
            SUM(total_oto) as total_oto,
            SUM(total_visitors) as total_visitors,
            SUM(total_ceu) as total_ceu,
            SUM(total_tyfcb) as total_tyfcb
          FROM (
            SELECT 
              start_date, end_date,
              SUM(p_present) as total_present,
              SUM(a_absent) as total_absent,
              SUM(l_late) as total_late,
              SUM(m_medical) as total_medical,
              SUM(s_substitute) as total_sub,
              SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
              SUM(rgi_referrals_given_internal) as total_referrals_internal,
              SUM(rgo_referrals_given_external) as total_referrals_external,
              SUM(one_to_ones) as total_oto,
              SUM(v_visitors) as total_visitors,
              SUM(ceu) as total_ceu,
              SUM(tyfcb_amount * 1000) as total_tyfcb,
              COUNT(DISTINCT member_id) as member_count
            FROM palms_reports
            WHERE (julianday(end_date) - julianday(start_date)) <= 14
            GROUP BY start_date, end_date
          ) sub
          GROUP BY month
          ORDER BY month ASC;
        `;
        const monthly = runSqlJson(sqlMonthly);

        const sqlJoins = `
          SELECT 
            replace(substr(event_date, 1, 7), '/', '-') as ym,
            COUNT(*) as join_count
          FROM visitors v
          JOIN visitors_status s ON v.id = s.visitor_id
          WHERE s.is_joined IN ('入会', '入会済')
          GROUP BY ym;
        `;
        const joins = runSqlJson(sqlJoins);
        const joinMap = {};
        joins.forEach(j => { if (j.ym) joinMap[j.ym] = Number(j.join_count) || 0; });
        monthly.forEach(m => {
          m.join_count = joinMap[m.month] || 0;
        });

        const sqlTerms = `
          SELECT 
            start_date, end_date,
            SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
            SUM(rgi_referrals_given_internal) as total_referrals_internal,
            SUM(rgo_referrals_given_external) as total_referrals_external,
            SUM(one_to_ones) as total_oto,
            SUM(v_visitors) as total_visitors,
            SUM(ceu) as total_ceu,
            SUM(tyfcb_amount * 1000) as total_tyfcb,
            COUNT(DISTINCT member_id) as member_count
          FROM palms_reports
          WHERE (julianday(end_date) - julianday(start_date)) > 60
          GROUP BY start_date, end_date
          ORDER BY start_date ASC;
        `;
        const terms = runSqlJson(sqlTerms);

        const sqlPeriods = `
          SELECT 
            start_date, end_date,
            CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER) as days_diff,
            SUM(tyfcb_amount * 1000) as tyfcb_yen,
            SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
            SUM(rgi_referrals_given_internal) as internal_referrals,
            SUM(rgo_referrals_given_external) as external_referrals,
            ROUND(CAST(SUM(rgo_referrals_given_external) AS FLOAT) / NULLIF(SUM(rgi_referrals_given_internal + rgo_referrals_given_external), 0) * 100, 1) as external_rate,
            SUM(v_visitors) as visitors,
            SUM(one_to_ones) as one_to_ones,
            SUM(ceu) as ceu,
            COUNT(DISTINCT member_id) as member_count
          FROM palms_reports
          GROUP BY start_date, end_date
          ORDER BY end_date DESC, days_diff ASC;
        `;
        const allGroups = runSqlJson(sqlPeriods);

        let oneMonthRaw = null;
        let sixMonthsRaw = null;
        let allTimeRaw = null;

        allGroups.forEach(row => {
          const diff = Number(row.days_diff) || 0;
          if (diff >= 20 && diff <= 45 && !oneMonthRaw) {
            oneMonthRaw = row;
          }
          if (diff >= 120 && diff <= 210 && !sixMonthsRaw) {
            sixMonthsRaw = row;
          }
          if (diff >= 300 && !allTimeRaw) {
            allTimeRaw = row;
          }
        });

        const formatPeriodData = (raw, label) => {
          if (!raw) {
            return {
              label: label,
              period_label: '--',
              start_date: null,
              end_date: null,
              tyfcb_yen: 0,
              tyfcb_formatted: '0 万円',
              total_referrals: 0,
              internal_referrals: 0,
              external_referrals: 0,
              external_rate: 0.0,
              visitors: 0,
              one_to_ones: 0,
              ceu: 0,
              member_count: 0
            };
          }
          const yen = Number(raw.tyfcb_yen) || 0;
          let formattedTyfcb = '0 万円';
          if (yen >= 100000000) {
            formattedTyfcb = (yen / 100000000).toLocaleString('ja-JP', { maximumFractionDigits: 2 }) + ' 億円';
          } else if (yen >= 10000) {
            const man = yen / 10000;
            formattedTyfcb = man.toLocaleString('ja-JP', { maximumFractionDigits: (man % 1 === 0 ? 0 : 1) }) + ' 万円';
          } else {
            formattedTyfcb = yen.toLocaleString('ja-JP') + ' 円';
          }

          return {
            label: label,
            period_label: `${raw.start_date || ''} 〜 ${raw.end_date || ''}`,
            start_date: raw.start_date || null,
            end_date: raw.end_date || null,
            tyfcb_yen: yen,
            tyfcb_formatted: formattedTyfcb,
            total_referrals: Number(raw.total_referrals) || 0,
            internal_referrals: Number(raw.internal_referrals) || 0,
            external_referrals: Number(raw.external_referrals) || 0,
            external_rate: Number(raw.external_rate) || 0.0,
            visitors: Number(raw.visitors) || 0,
            one_to_ones: Number(raw.one_to_ones) || 0,
            ceu: Number(raw.ceu) || 0,
            member_count: Number(raw.member_count) || 0
          };
        };

        return res.end(JSON.stringify({
          success: true,
          weekly: weekly,
          monthly: monthly,
          terms: terms,
          periods_summary: {
            one_month: formatPeriodData(oneMonthRaw, '1ヶ月の成果'),
            six_months: formatPeriodData(sixMonthsRaw, '半年間の成果'),
            all_time: formatPeriodData(allTimeRaw, '全期間の成果')
          }
        }));
      }

      if (action === 'periods') {
        const sql = `SELECT DISTINCT start_date, end_date, COUNT(*) as member_count FROM palms_reports GROUP BY start_date, end_date ORDER BY end_date DESC;`;
        const periods = runSqlJson(sql);
        return res.end(JSON.stringify({ success: true, periods: periods }));
      }

      if (action === 'sync') {
        try {
          const palmsFetcher = require('./scripts/fetch_bni_connect_palms.js');
          const range = palmsFetcher.getDefaultWeeklyRange();
          const startDate = input.startDate || urlObj.searchParams.get('startDate') || range.startDate;
          const endDate = input.endDate || urlObj.searchParams.get('endDate') || range.endDate;
          
          palmsFetcher.authenticate().then(tokens => {
            return palmsFetcher.establishWebSession(tokens);
          }).then(cookie => {
            return palmsFetcher.fetchPalmsReportHtml(cookie, startDate, endDate);
          }).then(html => {
            const records = palmsFetcher.parsePalmsHtml(html, startDate, endDate);
            const saved = palmsFetcher.savePalmsToDb(records);
            res.end(JSON.stringify({
              success: true,
              message: `PALMSデータを正常に取得・更新しました（${saved}件）`,
              data: { startDate, endDate, recordsCount: records.length, savedCount: saved }
            }));
          }).catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: err.message }));
          });
          return;
        } catch (e) {
          res.writeHead(500);
          return res.end(JSON.stringify({ success: false, error: e.message }));
        }
      }

      if (action === 'list') {
        const startDate = urlObj.searchParams.get('startDate');
        const endDate = urlObj.searchParams.get('endDate');
        let whereClause = "";
        let filterPeriod = { startDate, endDate };

        if (startDate && endDate) {
          whereClause = `WHERE p.start_date = '${startDate}' AND p.end_date = '${endDate}'`;
        } else {
          const latestRow = runSqlJson("SELECT start_date, end_date FROM palms_reports ORDER BY end_date DESC LIMIT 1;")[0];
          if (latestRow) {
            whereClause = `WHERE p.start_date = '${latestRow.start_date}' AND p.end_date = '${latestRow.end_date}'`;
            filterPeriod = { startDate: latestRow.start_date, endDate: latestRow.end_date };
          }
        }

        const sql = `
          SELECT 
            p.*,
            (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) as total_referrals_given,
            (p.rri_referrals_received_internal + p.rro_referrals_received_external) as total_referrals_received,
            (p.tyfcb_amount * 1000) as tyfcb_yen,
            m.category as member_category,
            m.profession as member_profession,
            COALESCE(m.status, '在籍') as member_status
          FROM palms_reports p
          LEFT JOIN (
            SELECT name, category, profession, status
            FROM (
              SELECT name, category, profession, status,
                     CASE WHEN category != 'その他' AND category != '' THEN 0 ELSE 1 END as priority
              FROM members
              ORDER BY priority ASC, id ASC
            )
            GROUP BY name
          ) m ON p.member_name = m.name
          ${whereClause}
          GROUP BY p.id
          ORDER BY (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) DESC, p.one_to_ones DESC, p.v_visitors DESC;
        `;
        let records = runSqlJson(sql);

        // Fallback: aggregate weekly records if no exact pre-calculated period matches
        if (records.length === 0 && startDate && endDate) {
          const aggSql = `
            SELECT 
              p.member_id,
              p.member_name,
              '${startDate}' as start_date,
              '${endDate}' as end_date,
              SUM(p.p_present) as p_present,
              SUM(p.a_absent) as a_absent,
              SUM(p.l_late) as l_late,
              SUM(p.m_medical) as m_medical,
              SUM(p.s_substitute) as s_substitute,
              SUM(p.rgi_referrals_given_internal) as rgi_referrals_given_internal,
              SUM(p.rgo_referrals_given_external) as rgo_referrals_given_external,
              SUM(p.rri_referrals_received_internal) as rri_referrals_received_internal,
              SUM(p.rro_referrals_received_external) as rro_referrals_received_external,
              SUM(p.v_visitors) as v_visitors,
              SUM(p.one_to_ones) as one_to_ones,
              SUM(p.tyfcb_amount) as tyfcb_amount,
              SUM(p.ceu) as ceu,
              SUM(p.testimonials) as testimonials,
              (SUM(p.rgi_referrals_given_internal) + SUM(p.rgo_referrals_given_external)) as total_referrals_given,
              (SUM(p.rri_referrals_received_internal) + SUM(p.rro_referrals_received_external)) as total_referrals_received,
              (SUM(p.tyfcb_amount) * 1000) as tyfcb_yen,
              m.category as member_category,
              m.profession as member_profession,
              COALESCE(m.status, '在籍') as member_status
            FROM palms_reports p
            LEFT JOIN (
              SELECT name, category, profession, status
              FROM (
                SELECT name, category, profession, status,
                       CASE WHEN category != 'その他' AND category != '' THEN 0 ELSE 1 END as priority
                FROM members
                ORDER BY priority ASC, id ASC
              )
              GROUP BY name
            ) m ON p.member_name = m.name
            WHERE (julianday(p.end_date) - julianday(p.start_date)) <= 14
              AND p.end_date >= '${startDate}' AND p.start_date <= '${endDate}'
            GROUP BY p.member_name
            ORDER BY (SUM(p.rgi_referrals_given_internal) + SUM(p.rgo_referrals_given_external)) DESC, SUM(p.one_to_ones) DESC, SUM(p.v_visitors) DESC;
          `;
          records = runSqlJson(aggSql);
        }

        return res.end(JSON.stringify({
          success: true,
          period: filterPeriod,
          totalMembers: records.length,
          records: records
        }));
      }
    }

    if (pathname === '/api/lottery.php') {
      const action = urlObj.searchParams.get('action') || 'list';

      if (action === 'list') {
        const historySql = `SELECT id, member_id, member_name, award_title, won_at, created_at FROM lottery_history ORDER BY won_at DESC, created_at DESC;`;
        const history = runSqlJson(historySql);

        const membersSql = `SELECT id, category, name, profession FROM members ORDER BY category, name;`;
        const rawMembers = runSqlJson(membersSql);

        // 重複排除＆当選集計
        const uniqueByName = {};
        rawMembers.forEach(m => {
          const cleanName = (m.name || '').replace(/\s+/g, '');
          if (!cleanName) return;
          if (!uniqueByName[cleanName]) {
            uniqueByName[cleanName] = m;
          } else {
            const existing = uniqueByName[cleanName];
            const existingHasCat = (existing.category && existing.category !== 'その他');
            const newHasCat = (m.category && m.category !== 'その他');
            if (!existingHasCat && newHasCat) {
              uniqueByName[cleanName] = m;
            } else if (m.profession && !existing.profession) {
              uniqueByName[cleanName] = m;
            }
          }
        });

        // 集計
        const members = Object.values(uniqueByName).map(m => {
          const mId = String(m.id);
          const cleanName = (m.name || '').replace(/\s+/g, '');
          const wonHistory = history.filter(h => String(h.member_id) === mId || (h.member_name || '').replace(/\s+/g, '') === cleanName);
          const winCount = wonHistory.length;
          const lastWonAt = wonHistory.length > 0 ? wonHistory[0].won_at : null;
          const awards = wonHistory.map(h => ({ award_title: h.award_title, won_at: h.won_at }));
          return {
            id: m.id,
            name: m.name,
            category: m.category || 'その他',
            profession: m.profession || '',
            win_count: winCount,
            last_won_at: lastWonAt,
            awards: awards
          };
        });

        return res.end(JSON.stringify({
          success: true,
          members: members,
          history: history
        }));
      }

      if (action === 'record') {
        const data = input || {};
        const memberId = (data.member_id || '').replace(/'/g, "''");
        const memberName = (data.member_name || '').replace(/'/g, "''");
        const awardTitle = (data.award_title || '定例会プレゼント').replace(/'/g, "''");
        const wonAt = (data.won_at || new Date().toISOString().split('T')[0].replace(/-/g, '/')).replace(/'/g, "''");
        const now = new Date().toISOString();
        const id = 'lot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        if (!memberId || !memberName) {
          res.writeHead(400);
          return res.end(JSON.stringify({ success: false, error: 'member_id and member_name are required' }));
        }

        const sql = `INSERT INTO lottery_history (id, member_id, member_name, award_title, won_at, created_at) VALUES ('${id}', '${memberId}', '${memberName}', '${awardTitle}', '${wonAt}', '${now}');`;
        runSqlExec(sql);
        return res.end(JSON.stringify({ success: true, message: '当選を記録しました', id: id }));
      }

      if (action === 'delete') {
        const data = input || {};
        const id = (data.id || urlObj.searchParams.get('id') || '').replace(/'/g, "''");
        if (!id) {
          res.writeHead(400);
          return res.end(JSON.stringify({ success: false, error: 'id is required' }));
        }
        runSqlExec(`DELETE FROM lottery_history WHERE id = '${id}';`);
        return res.end(JSON.stringify({ success: true, message: '履歴を削除しました' }));
      }

      if (action === 'reset') {
        runSqlExec(`DELETE FROM lottery_history;`);
        return res.end(JSON.stringify({ success: true, message: '全当選履歴をリセットしました' }));
      }
    }

    if (pathname === '/api/events.php') {
      const action = urlObj.searchParams.get('action') || 'list';

      if (action === 'list') {
        const scope = urlObj.searchParams.get('scope') || 'upcoming';
        const category = urlObj.searchParams.get('category') || '';
        const format = urlObj.searchParams.get('format') || '';
        const keyword = (urlObj.searchParams.get('keyword') || '').replace(/'/g, "''");

        let conditions = [];
        const todayStr = new Date().toISOString().substring(0, 10) + ' 00:00:00';
        if (scope === 'upcoming') {
          conditions.push(`start_datetime >= '${todayStr}'`);
        } else if (scope === 'past') {
          conditions.push(`start_datetime < '${todayStr}'`);
        }

        if (category) {
          conditions.push(`(event_type_name = '${category.replace(/'/g, "''")}' OR title LIKE '%${category.replace(/'/g, "''")}%')`);
        }

        if (format === 'online') conditions.push(`is_online = 1`);
        if (format === 'inperson') conditions.push(`is_online = 0`);

        if (keyword) {
          conditions.push(`(title LIKE '%${keyword}%' OR description LIKE '%${keyword}%' OR location_name LIKE '%${keyword}%' OR contact_name LIKE '%${keyword}%')`);
        }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const order = scope === 'past' ? 'DESC' : 'ASC';
        const events = runSqlJson(`SELECT * FROM region_events ${whereSql} ORDER BY start_datetime ${order} LIMIT 150;`);

        // Summary
        const nowIso = new Date().toISOString().substring(0, 19).replace('T', ' ');
        const curMonth = nowIso.substring(0, 7);
        const upcomingCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}';`)[0] || {}).c || 0, 10);
        const monthCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime LIKE '${curMonth}%';`)[0] || {}).c || 0, 10);
        const onlineCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}' AND is_online = 1;`)[0] || {}).c || 0, 10);
        const inpersonCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}' AND is_online = 0;`)[0] || {}).c || 0, 10);
        const nextEv = runSqlJson(`SELECT * FROM region_events WHERE start_datetime >= '${nowIso}' ORDER BY start_datetime ASC LIMIT 1;`)[0] || null;
        const lastSyncRow = runSqlJson(`SELECT value FROM settings WHERE key = 'last_events_synced_at';`)[0];

        // Categories & Months
        const catRows = runSqlJson(`SELECT DISTINCT event_type_name FROM region_events WHERE event_type_name != '' ORDER BY event_type_name ASC;`);
        const categories = catRows.map(r => r.event_type_name);
        const months = runSqlJson(`SELECT substr(start_datetime, 1, 7) as month_val, COUNT(*) as cnt FROM region_events GROUP BY month_val ORDER BY month_val ASC;`);

        return res.end(JSON.stringify({
          success: true,
          data: {
            events,
            summary: {
              totalUpcoming: upcomingCount,
              currentMonthTotal: monthCount,
              onlineCount,
              inPersonCount: inpersonCount,
              nextEvent: nextEv,
              lastSyncedAt: lastSyncRow ? lastSyncRow.value : null
            },
            categories,
            months
          }
        }));
      }

      if (action === 'calendar') {
        const month = urlObj.searchParams.get('month') || new Date().toISOString().substring(0, 7);
        const format = urlObj.searchParams.get('format') || '';
        const keyword = (urlObj.searchParams.get('keyword') || '').toLowerCase();
        const sourceType = urlObj.searchParams.get('source_type') || '';

        // Ensure chapter_events table exists
        try {
          runSqlExec(`CREATE TABLE IF NOT EXISTS chapter_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'チャプターイベント',
            start_datetime TEXT NOT NULL,
            end_datetime TEXT DEFAULT '',
            location_name TEXT DEFAULT '',
            location_url TEXT DEFAULT '',
            is_online INTEGER DEFAULT 0,
            organizer TEXT DEFAULT '',
            description TEXT DEFAULT '',
            recurrence_group_id TEXT DEFAULT '',
            recurrence_rule TEXT DEFAULT '',
            created_at TEXT,
            updated_at TEXT
          );`);
        } catch(e) {}

        const firstDay = month + '-01';
        const d = new Date(firstDay);
        const startRangeD = new Date(d);
        startRangeD.setDate(startRangeD.getDate() - 7);
        const endRangeD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        endRangeD.setDate(endRangeD.getDate() + 7);

        const startRangeStr = startRangeD.toISOString().substring(0, 10);
        const endRangeStr = endRangeD.toISOString().substring(0, 10);

        // 1. Regular Meetings (Thursdays & Custom Overrides)
        const meetings = [];
        let customRows = [];
        try {
          customRows = runSqlJson(`SELECT * FROM meeting_customizations WHERE meeting_date >= '${startRangeStr}' AND meeting_date <= '${endRangeStr}';`);
        } catch(e) {}
        const customMap = {};
        customRows.forEach(cr => { customMap[cr.meeting_date] = cr; });

        let curD = new Date(startRangeStr);
        const endD = new Date(endRangeStr);
        while (curD <= endD) {
          const dateStr = curD.toISOString().substring(0, 10);
          const isThursday = (curD.getDay() === 4);
          const hasCustom = !!customMap[dateStr];

          if (isThursday || hasCustom) {
            const visitorRows = runSqlJson(`
              SELECT v.id, v.event_date, v.visitor_name, v.furigana, v.company, v.profession, v.inviter,
                     COALESCE(v.category, 'ビジター') as category,
                     COALESCE(s.is_attended, '未') as is_attended,
                     COALESCE(s.is_joined, '未') as is_joined
              FROM visitors v
              LEFT JOIN visitors_status s ON v.id = s.visitor_id
              WHERE v.event_date LIKE '%${dateStr}%' OR v.event_date = '${dateStr.replace(/-/g, '/')}';
            `);
            const custom = customMap[dateStr] || null;
            const dayVisitors = visitorRows.map(r => ({
              id: String(r.id),
              name: r.visitor_name || ('ビジター No.' + r.id),
              furigana: r.furigana || '',
              company: r.company || '',
              profession: r.profession || '',
              inviter: r.inviter || '',
              category: r.category || 'ビジター',
              is_attended: r.is_attended || '未',
              is_joined: r.is_joined || '未'
            }));

            meetings.push({
              id: 'mt_' + dateStr,
              meeting_date: dateStr,
              source_type: 'meeting',
              title: custom ? (custom.title || 'REvoチャプター 定例会') : 'REvoチャプター 定例会',
              category: custom ? (custom.category || '定例会') : '定例会',
              start_datetime: (custom && custom.start_datetime) ? custom.start_datetime : (dateStr + ' 06:00:00'),
              end_datetime: (custom && custom.end_datetime) ? custom.end_datetime : (dateStr + ' 08:30:00'),
              location_name: custom ? (custom.location_name || 'Zoom') : 'Zoom',
              location_url: custom ? (custom.location_url || '') : '',
              is_online: custom ? (custom.is_online ? 1 : 0) : 1, // 基本Zoom
              organizer: custom ? (custom.organizer || 'REvoチャプター プレジデント & 運営チーム') : 'REvoチャプター プレジデント & 運営チーム',
              description: custom ? (custom.description || '毎週木曜日のビジネスミーティング。ビジター参加・見学歓迎！\nメンバー 6:00 / ビジター 6:40 受付開始 / 7:00 開会 / 8:30 閉会') : '毎週木曜日のビジネスミーティング。ビジター参加・見学歓迎！\nメンバー 6:00 / ビジター 6:40 受付開始 / 7:00 開会 / 8:30 閉会',
              visitor_count: dayVisitors.length,
              visitors: dayVisitors,
              is_customized: custom ? 1 : 0
            });
          }
          curD.setDate(curD.getDate() + 1);
        }

        // 2. Chapter Events
        let chapterRows = [];
        try {
          chapterRows = runSqlJson(`SELECT * FROM chapter_events WHERE start_datetime >= '${startRangeStr} 00:00:00' AND start_datetime <= '${endRangeStr} 23:59:59' ORDER BY start_datetime ASC;`);
        } catch(e) {}
        const chapterEvents = chapterRows.map(ev => ({ ...ev, source_type: 'chapter' }));

        // 3. Training Events
        let trainingRows = [];
        try {
          trainingRows = runSqlJson(`SELECT * FROM region_events WHERE start_datetime >= '${startRangeStr} 00:00:00' AND start_datetime <= '${endRangeStr} 23:59:59' ORDER BY start_datetime ASC;`);
        } catch(e) {}
        const trainingEvents = trainingRows.map(ev => ({
          ...ev,
          source_type: 'training',
          category: ev.event_type_name || 'トレーニング'
        }));

        let all = [...meetings, ...chapterEvents, ...trainingEvents];
        all.sort((a, b) => (a.start_datetime > b.start_datetime ? 1 : -1));

        if (sourceType) {
          all = all.filter(e => e.source_type === sourceType);
        }
        if (format === 'online') {
          all = all.filter(e => !!e.is_online);
        } else if (format === 'inperson') {
          all = all.filter(e => !e.is_online);
        }
        if (keyword) {
          all = all.filter(e => (
            (e.title || '').toLowerCase().includes(keyword) ||
            (e.description || '').toLowerCase().includes(keyword) ||
            (e.location_name || '').toLowerCase().includes(keyword) ||
            (e.category || '').toLowerCase().includes(keyword) ||
            (e.organizer || '').toLowerCase().includes(keyword)
          ));
        }

        // Summary
        const nowIso = new Date().toISOString().substring(0, 19).replace('T', ' ');
        const curMonth = nowIso.substring(0, 7);
        const upcomingCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}';`)[0] || {}).c || 0, 10);
        const monthCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime LIKE '${curMonth}%';`)[0] || {}).c || 0, 10);
        const onlineCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}' AND is_online = 1;`)[0] || {}).c || 0, 10);
        const inpersonCount = parseInt((runSqlJson(`SELECT COUNT(*) as c FROM region_events WHERE start_datetime >= '${nowIso}' AND is_online = 0;`)[0] || {}).c || 0, 10);
        const nextEv = runSqlJson(`SELECT * FROM region_events WHERE start_datetime >= '${nowIso}' ORDER BY start_datetime ASC LIMIT 1;`)[0] || null;
        const lastSyncRow = runSqlJson(`SELECT value FROM settings WHERE key = 'last_events_synced_at';`)[0];

        return res.end(JSON.stringify({
          success: true,
          data: {
            month,
            events: all,
            summary: {
              totalUpcoming: upcomingCount,
              currentMonthTotal: monthCount,
              onlineCount,
              inPersonCount: inpersonCount,
              nextEvent: nextEv,
              lastSyncedAt: lastSyncRow ? lastSyncRow.value : null
            }
          }
        }));
      }

      if (action === 'save_chapter_event') {
        const body = input || {};
        const id = body.id || ('ch_' + Date.now());
        const title = (body.title || '').replace(/'/g, "''");
        const category = (body.category || 'チャプターイベント').replace(/'/g, "''");
        const startDatetime = (body.start_datetime || '').replace(/'/g, "''");
        const endDatetime = (body.end_datetime || '').replace(/'/g, "''");
        const locationName = (body.location_name || '').replace(/'/g, "''");
        const locationUrl = (body.location_url || '').replace(/'/g, "''");
        const isOnline = body.is_online ? 1 : 0;
        const organizer = (body.organizer || '').replace(/'/g, "''");
        const description = (body.description || '').replace(/'/g, "''");
        const recurrenceRule = (body.recurrence_rule || body.repeat_type || 'none').replace(/'/g, "''");
        const recurrenceUntil = (body.recurrence_until || body.repeat_until || '').replace(/'/g, "''");
        const recurrenceCount = parseInt(body.recurrence_count || body.repeat_count || 0, 10);
        const now = new Date().toISOString().substring(0, 19).replace('T', ' ');

        try {
          if (!body.id && ['weekdays', 'daily', 'weekly', 'biweekly', 'monthly'].includes(recurrenceRule)) {
            const groupId = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const startTimeStr = startDatetime.length >= 11 ? startDatetime.substring(11) : '00:00:00';
            const endTimeStr = endDatetime.length >= 11 ? endDatetime.substring(11) : '';
            const startDateStr = startDatetime.substring(0, 10);

            const startObj = new Date(startDateStr.replace(/-/g, '/'));
            let untilObj = recurrenceUntil ? new Date(recurrenceUntil.replace(/-/g, '/')) : new Date(startObj.getTime() + 90 * 86400000);
            if (isNaN(untilObj.getTime()) || untilObj < startObj) {
              untilObj = new Date(startObj.getTime() + 90 * 86400000);
            }

            const maxCount = recurrenceCount > 0 ? Math.min(recurrenceCount, 120) : 120;
            let currentObj = new Date(startObj.getTime());

            // If weekdays and starting date falls on weekend, advance to next Monday
            if (recurrenceRule === 'weekdays') {
              while (currentObj.getDay() === 0 || currentObj.getDay() === 6) {
                currentObj.setDate(currentObj.getDate() + 1);
              }
            }

            let createdCount = 0;
            let firstId = '';

            while (createdCount < maxCount && currentObj <= untilObj) {
              const y = currentObj.getFullYear();
              const m = String(currentObj.getMonth() + 1).padStart(2, '0');
              const d = String(currentObj.getDate()).padStart(2, '0');
              const curDateStr = `${y}-${m}-${d}`;

              const curStart = `${curDateStr} ${startTimeStr}`;
              const curEnd = endTimeStr ? `${curDateStr} ${endTimeStr}` : '';
              const curId = 'ch_' + Date.now() + '_' + createdCount;
              if (createdCount === 0) firstId = curId;

              runSqlExec(`INSERT OR REPLACE INTO chapter_events (id, title, category, start_datetime, end_datetime, location_name, location_url, is_online, organizer, description, recurrence_group_id, recurrence_rule, created_at, updated_at)
                       VALUES ('${curId}', '${title}', '${category}', '${curStart}', '${curEnd}', '${locationName}', '${locationUrl}', ${isOnline}, '${organizer}', '${description}', '${groupId}', '${recurrenceRule}', '${now}', '${now}');`);

              createdCount++;

              if (recurrenceRule === 'weekdays') {
                do {
                  currentObj.setDate(currentObj.getDate() + 1);
                } while (currentObj.getDay() === 0 || currentObj.getDay() === 6);
              } else if (recurrenceRule === 'daily') {
                currentObj.setDate(currentObj.getDate() + 1);
              } else if (recurrenceRule === 'weekly') {
                currentObj.setDate(currentObj.getDate() + 7);
              } else if (recurrenceRule === 'biweekly') {
                currentObj.setDate(currentObj.getDate() + 14);
              } else if (recurrenceRule === 'monthly') {
                currentObj.setMonth(currentObj.getMonth() + 1);
              } else {
                break;
              }
            }

            return res.end(JSON.stringify({
              success: true,
              message: `${createdCount}件の定期予定を一括登録しました`,
              id: firstId,
              count: createdCount,
              group_id: groupId
            }));
          }

          runSqlExec(`INSERT OR REPLACE INTO chapter_events (id, title, category, start_datetime, end_datetime, location_name, location_url, is_online, organizer, description, recurrence_group_id, recurrence_rule, created_at, updated_at)
                   VALUES ('${id}', '${title}', '${category}', '${startDatetime}', '${endDatetime}', '${locationName}', '${locationUrl}', ${isOnline}, '${organizer}', '${description}', '${body.recurrence_group_id || ''}', '${recurrenceRule}', '${now}', '${now}');`);
          return res.end(JSON.stringify({ success: true, message: 'チャプター予定を保存しました', id, count: 1 }));
        } catch(e) {
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      }

      if (action === 'delete_chapter_event') {
        const body = input || {};
        const id = body.id || urlObj.searchParams.get('id');
        const deleteSeries = body.delete_series || urlObj.searchParams.get('delete_series') === '1' || urlObj.searchParams.get('delete_series') === 'true';
        try {
          if (deleteSeries) {
            const ev = runSqlJson(`SELECT recurrence_group_id FROM chapter_events WHERE id = '${id}';`)[0];
            if (ev && ev.recurrence_group_id) {
              runSqlExec(`DELETE FROM chapter_events WHERE recurrence_group_id = '${ev.recurrence_group_id}';`);
              return res.end(JSON.stringify({ success: true, message: '繰り返し予定を一括削除しました' }));
            }
          }
          runSqlExec(`DELETE FROM chapter_events WHERE id = '${id}';`);
          return res.end(JSON.stringify({ success: true, message: 'チャプター予定を削除しました' }));
        } catch(e) {
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      }

      if (action === 'get_chapter_event') {
        const id = urlObj.searchParams.get('id');
        const event = runSqlJson(`SELECT * FROM chapter_events WHERE id = '${id}';`)[0] || null;
        return res.end(JSON.stringify({ success: true, data: { event } }));
      }

      if (action === 'save_meeting_customization' || action === 'save_meeting') {
        const body = input || {};
        const meetingDate = (body.meeting_date || '').replace(/'/g, "''");
        if (!meetingDate) {
          return res.end(JSON.stringify({ success: false, message: '定例会の日付が指定されていません' }));
        }
        const title = (body.title || 'REvoチャプター 定例会').replace(/'/g, "''");
        const category = (body.category || '定例会').replace(/'/g, "''");
        const isOnline = body.is_online ? 1 : 0;
        const locationName = (body.location_name || '').replace(/'/g, "''");
        const locationUrl = (body.location_url || '').replace(/'/g, "''");
        const startDatetime = (body.start_datetime || (meetingDate + ' 06:00:00')).replace(/'/g, "''");
        const endDatetime = (body.end_datetime || (meetingDate + ' 08:30:00')).replace(/'/g, "''");
        const organizer = (body.organizer || 'REvoチャプター プレジデント & 運営チーム').replace(/'/g, "''");
        const description = (body.description || '').replace(/'/g, "''");
        const now = new Date().toISOString().substring(0, 19).replace('T', ' ');

        try {
          runSqlExec(`INSERT OR REPLACE INTO meeting_customizations (meeting_date, title, category, is_online, location_name, location_url, start_datetime, end_datetime, organizer, description, created_at, updated_at)
                     VALUES ('${meetingDate}', '${title}', '${category}', ${isOnline}, '${locationName}', '${locationUrl}', '${startDatetime}', '${endDatetime}', '${organizer}', '${description}', '${now}', '${now}');`);
          return res.end(JSON.stringify({ success: true, message: `${meetingDate} の定例会情報を更新しました` }));
        } catch(e) {
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      }

      if (action === 'reset_meeting_customization' || action === 'reset_meeting') {
        const body = input || {};
        const meetingDate = (body.meeting_date || urlObj.searchParams.get('meeting_date') || '').replace(/'/g, "''");
        if (!meetingDate) {
          return res.end(JSON.stringify({ success: false, message: '定例会の日付が指定されていません' }));
        }
        try {
          runSqlExec(`DELETE FROM meeting_customizations WHERE meeting_date = '${meetingDate}';`);
          return res.end(JSON.stringify({ success: true, message: `${meetingDate} の定例会情報をデフォルトに戻しました` }));
        } catch(e) {
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      }

      if (action === 'get') {
        const id = parseInt(urlObj.searchParams.get('id'), 10);
        const event = runSqlJson(`SELECT * FROM region_events WHERE id = ${id};`)[0] || null;
        return res.end(JSON.stringify({ success: true, data: { event } }));
      }

      if (action === 'sync') {
        try {
          const fetcher = require('./scripts/fetch_region_events');
          if (fetcher && fetcher.run) {
            fetcher.run().then(() => {
              res.end(JSON.stringify({ success: true, message: 'イベント情報を同期しました' }));
            }).catch(err => {
              res.end(JSON.stringify({ success: false, message: err.message }));
            });
            return;
          }
        } catch(e) {
          return res.end(JSON.stringify({ success: false, message: e.message }));
        }
      }
    }

    return res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
  });
}

const server = http.createServer((req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);

    if (urlObj.pathname.startsWith('/api/')) {
      return handleApiRequest(req, res, urlObj);
    }

    // Serve public static assets if requested
    if (urlObj.pathname.startsWith('/public/')) {
      const staticPath = path.join(__dirname, urlObj.pathname);
      if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        const ext = path.extname(staticPath).toLowerCase();
        const mimeTypes = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        return fs.createReadStream(staticPath).pipe(res);
      }
    }

    // Fallback: serve built HTML
    const html = buildHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end("Local Server Error:\n" + err.stack);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 ローカルテストサーバーが起動しました: http://localhost:${PORT}`);
  console.log(`💡 ローカルSQLiteデータベース (api/data/database.sqlite) と直接接続して動作しています。`);
});
