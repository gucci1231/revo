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
        const sSql = `SELECT * FROM visitors_status WHERE visitor_id = '${id.replace(/'/g, "''")}';`;
        const hSql = `SELECT * FROM hearing_sheets WHERE visitor_id = '${id.replace(/'/g, "''")}';`;
        const apSql = `SELECT * FROM action_plans WHERE visitor_id = '${id.replace(/'/g, "''")}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`;
        const mSql = `SELECT id, category, name, profession FROM members ORDER BY category, name;`;

        const v = runSqlJson(vSql)[0] || null;
        const s = runSqlJson(sSql)[0] || { is_attended: '未', is_joined: '未', is_1to1: '未', is_matched: '未' };
        const h = runSqlJson(hSql)[0] || null;
        const actionPlans = runSqlJson(apSql);
        const members = runSqlJson(mSql);

        const catMap = {};
        members.forEach(m => {
          const cat = m.category || 'その他';
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push({ id: m.id, name: m.name, profession: m.profession });
        });
        const memberCategories = Object.keys(catMap).map(c => ({ category: c, members: catMap[c] }));

        if (!v) return res.end(JSON.stringify({ success: false, message: 'Visitor not found' }));

        return res.end(JSON.stringify({
          success: true,
          visitor: {
            id: v.id, createdAt: v.created_at, inviter: v.inviter, eventDate: v.event_date,
            name: v.visitor_name, furigana: v.furigana, profession: v.profession, company: v.company,
            email: v.email, attendanceCount: v.attendance_count, remarks: v.remarks
          },
          status: {
            isAttended: s.is_attended || '未', isJoined: s.is_joined || '未', is1to1: s.is_1to1 || '未', matching: s.is_matched || '未'
          },
          hearing: h ? {
            orientUser: h.orient_user, q1: h.q1, q2: h.q2, q3: h.q3, q4: h.q4, q5: h.q5, q6: h.q6, q7: h.q7,
            feelAbc: h.feel_abc, orientMemo: h.orient_memo, followMemo: h.follow_memo, sheetUrl: h.sheet_url, updatedAt: h.updated_at
          } : null,
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

      if (action === 'list') {
        const vId = esc(urlObj.searchParams.get('visitorId') || input.visitorId || '');
        const sql = `SELECT * FROM action_plans WHERE visitor_id = '${vId}' ORDER BY is_completed ASC, due_date ASC, created_at DESC;`;
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

        if (isJoinedBool) totalJoinedCount++;
        if (isAttendedBool) totalAttendedCount++;
        if (r.hasHearingSheet) totalHearingCount++;

        const feel = (r.feelAbc || '').toUpperCase().trim();
        if (feel === 'A' && !isJoinedBool) {
          hotVisitors.push(r);
        }

        const eDate = (r.eventDate || '').trim();
        if (eDate !== '') {
          if (!weeklyMap[eDate]) {
            weeklyMap[eDate] = { date: eDate, applyCount: 0, attendedCount: 0, joinedCount: 0 };
          }
          weeklyMap[eDate].applyCount++;
          if (isAttendedBool) weeklyMap[eDate].attendedCount++;
          if (isJoinedBool) weeklyMap[eDate].joinedCount++;

          const mKey = eDate.substring(0, 7);
          if (/^\d{4}[\/\-]\d{2}$/.test(mKey)) {
            if (!monthlyMap[mKey]) {
              monthlyMap[mKey] = { month: mKey, applyCount: 0, attendedCount: 0, joinedCount: 0 };
            }
            monthlyMap[mKey].applyCount++;
            if (isAttendedBool) monthlyMap[mKey].attendedCount++;
            if (isJoinedBool) monthlyMap[mKey].joinedCount++;
          }
        }
      });

      const weeklyKeys = Object.keys(weeklyMap).sort().reverse();
      const weeklyStats = weeklyKeys.map(k => weeklyMap[k]);

      const monthlyKeys = Object.keys(monthlyMap).sort().reverse();
      const monthlyStats = monthlyKeys.map(k => {
        const m = monthlyMap[k];
        const rate = m.applyCount > 0 ? ((m.joinedCount / m.applyCount) * 100).toFixed(1) : "0.0";
        return { ...m, joinRate: rate + "%" };
      });

      const chartDates = weeklyKeys.slice(0, 10).reverse();
      const chartLabels = chartDates.map(d => d.substring(5));
      const chartData = chartDates.map(d => weeklyMap[d].applyCount);

      const meetingCount = Math.max(1, weeklyKeys.length);
      const avgVisitorCount = (totalApplyCount / meetingCount).toFixed(1);

      return res.end(JSON.stringify({
        success: true,
        nextThuStr: "08/13",
        afterNextThuStr: "08/20",
        lastThuStr: "08/06",
        metrics: {
          applyCount: totalApplyCount,
          joinedCount: totalJoinedCount,
          targetJoinGoal: 12,
          achievementRate: totalJoinedCount > 0 ? ((totalJoinedCount / 12) * 100).toFixed(1) : "0.0",
          joinRate: totalApplyCount > 0 ? ((totalJoinedCount / totalApplyCount) * 100).toFixed(1) : "0.0",
          nextThuCount: nextMeetingVisitors.length,
          afterNextThuCount: 0,
          avgVisitorCount: avgVisitorCount,
          feedbackRate: "85.0",
          hearingRate: totalApplyCount > 0 ? ((totalHearingCount / totalApplyCount) * 100).toFixed(1) : "0.0",
          hotVisitorCount: hotVisitors.length,
          pendingActionPlansCount: pendingApCount,
          overdueActionPlansCount: overdueApCount
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
