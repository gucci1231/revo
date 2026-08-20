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
              v.attendance_count as attendanceCount, v.remarks,
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
            COALESCE(v.email, '') as email, COALESCE(v.attendance_count, '初めて') as attendanceCount, COALESCE(v.remarks, '') as remarks,
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
            email: v.email, attendanceCount: v.attendance_count, remarks: v.remarks,
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
      const action = parsedUrl.query.action || (input ? input.action : 'get');

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
        if (map[norm]) {
          return { ...map[norm], month: norm, source: 'custom', is_custom: true };
        }
        const past = Object.keys(map).filter(k => k < norm).sort().reverse();
        if (past.length > 0) {
          return { ...map[past[0]], month: norm, source: 'inherited', inherited_from: past[0], is_custom: false };
        }
        return { ...def, month: norm, source: 'default', is_custom: false };
      };

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
          target_visitors_weekly: Number(goals.target_visitors_weekly || 4),
          target_join_rate: Number(goals.target_join_rate || 25.0),
          target_hearing_rate: Number(goals.target_hearing_rate || 100.0)
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

      const weeklyKeys = Object.keys(weeklyMap).sort().reverse();
      const weeklyStats = weeklyKeys.map(k => {
        const w = weeklyMap[k];
        const total = w.applyCount;
        const feelRates = {
          A: total > 0 ? ((w.feelCounts.A / total) * 100).toFixed(1) + "%" : "0.0%",
          B: total > 0 ? ((w.feelCounts.B / total) * 100).toFixed(1) + "%" : "0.0%",
          C: total > 0 ? ((w.feelCounts.C / total) * 100).toFixed(1) + "%" : "0.0%"
        };
        return { ...w, feelRates };
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
        return {
          ...m,
          joinRate: rate + "%",
          feelRates,
          goal: g,
          targetJoined: g.target_joined || 2,
          targetVisitorsWeekly: g.target_visitors_weekly || 4,
          targetJoinRate: (g.target_join_rate || 25.0) + "%",
          targetHearingRate: (g.target_hearing_rate || 100.0) + "%",
          isCustomGoal: !!g.is_custom,
          goalSource: g.source || "default"
        };
      });

      const chartDates = weeklyKeys.slice(0, 10).reverse();
      const chartLabels = chartDates.map(d => d.substring(5));
      const chartData = chartDates.map(d => weeklyMap[d].applyCount);

      const meetingCount = Math.max(1, weeklyKeys.length);
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
      const sql = `SELECT id, category, name, profession FROM members ORDER BY category, name;`;
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
