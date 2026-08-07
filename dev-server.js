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

        const v = runSqlJson(vSql)[0] || null;
        const s = runSqlJson(sSql)[0] || { is_attended: '未', is_joined: '未', is_1to1: '未', is_matched: '未' };
        const h = runSqlJson(hSql)[0] || null;

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

      visitors.forEach(r => {
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
          hotVisitorCount: hotVisitors.length
        },
        chart: { labels: chartLabels, data: chartData },
        tables: {
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
