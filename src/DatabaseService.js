/**
 * Visitor Host Revolution 2.0
 * データベーススキーマ管理 ＆ 温度感高いビジター(HOT)事前集計サービス
 */

/**
 * データベーススキーマの初期化
 */
let _dbSchemaInitialized = false;

function initDatabaseSchema() {
  if (_dbSchemaInitialized) return;
  const ss = SheetUtil.getSpreadsheet();

  // Fast check: if SUMMARY_CACHE sheet already exists, schema is already initialized
  if (ss.getSheetByName(SHEET_NAMES.SUMMARY_CACHE)) {
    _dbSchemaInitialized = true;
    return;
  }

  const tables = [
    {
      name: SHEET_NAMES.VISITORS,
      headers: ["id", "created_at", "inviter", "event_date", "visitor_name", "furigana", "profession", "company", "email", "attendance_count", "remarks"]
    },
    {
      name: SHEET_NAMES.VISITORS_STATUS,
      headers: ["visitor_id", "is_attended", "is_joined", "is_1to1", "is_matched", "matching_note", "updated_at"]
    },
    {
      name: SHEET_NAMES.HEARING_SHEETS,
      headers: ["visitor_id", "orient_user", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "feel_abc", "orient_memo", "follow_memo", "sheet_url", "updated_at"]
    },
    {
      name: SHEET_NAMES.MAIL_HISTORIES,
      headers: ["visitor_id", "mail_type", "sent_at", "status"]
    },
    {
      name: SHEET_NAMES.MAIL_REACTIONS,
      headers: ["visitor_id", "reaction_type", "content", "recorded_at"]
    },
    {
      name: SHEET_NAMES.MEMBERS,
      headers: ["id", "category", "name", "profession", "updated_at"]
    },
    {
      name: SHEET_NAMES.SETTINGS,
      headers: ["key", "value", "updated_at"]
    },
    {
      name: SHEET_NAMES.SUMMARY_CACHE,
      headers: ["json_data", "updated_at"]
    }
  ];

  tables.forEach(t => {
    let sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
      sheet.getRange(1, 1, 1, t.headers.length).setValues([t.headers]);
      sheet.getRange(1, 1, 1, t.headers.length).setFontWeight("bold").setBackground("#f1f3f5");
      sheet.setFrozenRows(1);
    }
  });

  const membersSheet = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  if (membersSheet && membersSheet.getLastRow() <= 1) {
    seedDefaultMembers(membersSheet);
  }

  const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(["start_date", "2026/04/01", new Date()]);
  }
}

/**
 * スプレッドシートデータのフォーマット一括チェック ＆ 自動修復処理
 */
function runDataFormatCheckAndRepair() {
  initDatabaseSchema();
  let fixLogs = [];
  const now = new Date();

  // 1. 各主要シートのヘッダー定義チェック ＆ 自動復元
  const requiredTables = [
    {
      name: SHEET_NAMES.VISITORS,
      headers: ["id", "created_at", "inviter", "event_date", "visitor_name", "furigana", "profession", "company", "email", "attendance_count", "remarks"]
    },
    {
      name: SHEET_NAMES.VISITORS_STATUS,
      headers: ["visitor_id", "is_attended", "is_joined", "is_1to1", "is_matched", "matching_note", "updated_at"]
    },
    {
      name: SHEET_NAMES.HEARING_SHEETS,
      headers: ["visitor_id", "orient_user", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "feel_abc", "orient_memo", "follow_memo", "sheet_url", "updated_at"]
    },
    {
      name: SHEET_NAMES.MEMBERS,
      headers: ["id", "category", "name", "profession", "updated_at"]
    },
    {
      name: SHEET_NAMES.SETTINGS,
      headers: ["key", "value", "updated_at"]
    },
    {
      name: SHEET_NAMES.SUMMARY_CACHE,
      headers: ["json_data", "updated_at"]
    }
  ];

  requiredTables.forEach(t => {
    let sheet = SheetUtil.getSheet(t.name);
    if (!sheet) return;

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, t.headers.length).setValues([t.headers]);
      sheet.getRange(1, 1, 1, t.headers.length).setFontWeight("bold").setBackground("#f1f3f5");
      sheet.setFrozenRows(1);
      fixLogs.push(`シート [${t.name}] にヘッダーを新規設定しました`);
    } else {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      let headerMismatch = false;
      for (let i = 0; i < t.headers.length; i++) {
        if (String(currentHeaders[i] || "").trim() !== t.headers[i]) {
          headerMismatch = true;
          break;
        }
      }
      if (headerMismatch) {
        sheet.getRange(1, 1, 1, t.headers.length).setValues([t.headers]);
        sheet.getRange(1, 1, 1, t.headers.length).setFontWeight("bold").setBackground("#f1f3f5");
        sheet.setFrozenRows(1);
        fixLogs.push(`シート [${t.name}] のヘッダーを正しく修復しました`);
      }
    }
  });

  // 2. visitors シートのデータ・日付フォーマット正規化 ＆ 欠損IDの調整
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);

  let visitorNameMap = {}; // 氏名 -> IDのマッピング
  let existingVisitorIds = new Set();

  if (visitorsSheet && visitorsSheet.getLastRow() > 1) {
    const vRange = visitorsSheet.getRange(2, 1, visitorsSheet.getLastRow() - 1, 11);
    const vValues = vRange.getValues();
    let updatedVValues = false;

    for (let i = 0; i < vValues.length; i++) {
      const r = vValues[i];
      let vId = String(r[0] || "").trim();
      const name = String(r[4] || "").trim();
      const eventDateVal = r[3];

      if (vId) existingVisitorIds.add(vId);
      if (name) visitorNameMap[name] = vId;

      // 日付フォーマットの正規化 ('2026年8月7日' や '8/7' 等をDate型へ統一)
      if (eventDateVal) {
        const parsedD = DateUtil.parse(eventDateVal);
        if (parsedD instanceof Date && !isNaN(parsedD.getTime())) {
          if (!(eventDateVal instanceof Date) || DateUtil.format(eventDateVal) !== DateUtil.format(parsedD)) {
            vValues[i][3] = parsedD;
            updatedVValues = true;
          }
        }
      }
    }

    if (updatedVValues) {
      vRange.setValues(vValues);
      fixLogs.push(`visitors シートの日付フォーマットを標準Date形式に正規化しました`);
    }
  }

  // 3. visitors_status シートの欠損レコード自動補完
  if (visitorsSheet && statusSheet && visitorsSheet.getLastRow() > 1) {
    const sData = statusSheet.getLastRow() > 1 ? statusSheet.getDataRange().getValues() : [];
    let existingStatusIds = new Set();
    for (let i = 1; i < sData.length; i++) {
      const sId = String(sData[i][0] || "").trim();
      if (sId) existingStatusIds.add(sId);
    }

    let newStatusRows = [];
    existingVisitorIds.forEach(vId => {
      if (!existingStatusIds.has(vId)) {
        newStatusRows.push([vId, "未", "未", "未", "未", "", now]);
      }
    });

    if (newStatusRows.length > 0) {
      statusSheet.getRange(statusSheet.getLastRow() + 1, 1, newStatusRows.length, newStatusRows[0].length).setValues(newStatusRows);
      fixLogs.push(`visitors_status に不足していた ${newStatusRows.length} 件のステータス行を補完しました`);
    }
  }

  // 4. hearing_sheets シートのID紐付け検証 ＆ トリム正規化
  if (hearingSheet && hearingSheet.getLastRow() > 1) {
    const hRange = hearingSheet.getRange(2, 1, hearingSheet.getLastRow() - 1, 14);
    const hValues = hRange.getValues();
    let updatedHValues = false;

    for (let i = 0; i < hValues.length; i++) {
      let vId = String(hValues[i][0] || "").trim();
      if (!vId) {
        // IDが空で、orient_user欄等にビジター名が入っている場合に名前からIDを自動復元
        const orientUser = String(hValues[i][1] || "").trim();
        if (orientUser && visitorNameMap[orientUser]) {
          hValues[i][0] = visitorNameMap[orientUser];
          updatedHValues = true;
          fixLogs.push(`hearing_sheets 行${i + 2} の未設定IDを氏名「${orientUser}」からID:${visitorNameMap[orientUser]} に自動紐付けしました`);
        }
      } else if (hValues[i][0] !== vId) {
        hValues[i][0] = vId; // 余分なスペースのトリム
        updatedHValues = true;
      }
    }

    if (updatedHValues) {
      hRange.setValues(hValues);
    }
  }

  // 5. 最新のサマリーキャッシュを再計算・保存
  // 壊れた行 (ID >= 227 や 1970/01/01、ヘッダー文字列) のクリーンアップ
  const cleanupRes = cleanupCorruptedVisitorData();
  if (cleanupRes) fixLogs.push(cleanupRes);

  updateSummaryCacheTable();

  return {
    success: true,
    logs: fixLogs.length > 0 ? fixLogs : ["データフォーマットに問題はありませんでした。正常な状態です。"]
  };
}

/**
 * 壊れたデータ行（ID >= 227 や 1970/01/01、ヘッダー文字列）の自動削除クリーンアップ
 */
function cleanupCorruptedVisitorData() {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);

  let cleanedCount = 0;

  if (visitorsSheet && visitorsSheet.getLastRow() > 1) {
    const vData = visitorsSheet.getDataRange().getValues();
    let validVRows = [vData[0]]; // ヘッダー行を維持

    for (let i = 1; i < vData.length; i++) {
      const r = vData[i];
      const vId = Number(r[0]);
      const name = String(r[4] || "").trim();
      const eventDateVal = r[3];
      const eventDateStr = eventDateVal ? DateUtil.format(eventDateVal, "yyyy/MM/dd") : "";

      const isCorrupted = (vId >= 227) || 
                          (eventDateStr === "1970/01/01") ||
                          (["氏名", "招待者", "ZOOM経験", "チャプター名", "お仕事の専門分野"].includes(name));

      if (isCorrupted) {
        cleanedCount++;
      } else {
        validVRows.push(r);
      }
    }

    if (cleanedCount > 0) {
      visitorsSheet.clearContents();
      visitorsSheet.getRange(1, 1, validVRows.length, validVRows[0].length).setValues(validVRows);
    }
  }

  if (statusSheet && statusSheet.getLastRow() > 1) {
    const sData = statusSheet.getDataRange().getValues();
    let validSRows = [sData[0]];
    for (let i = 1; i < sData.length; i++) {
      const sId = Number(sData[i][0]);
      if (sId < 227) {
        validSRows.push(sData[i]);
      }
    }
    statusSheet.clearContents();
    if (validSRows.length > 0) {
      statusSheet.getRange(1, 1, validSRows.length, validSRows[0].length).setValues(validSRows);
    }
  }

  if (hearingSheet && hearingSheet.getLastRow() > 1) {
    const hData = hearingSheet.getDataRange().getValues();
    let validHRows = [hData[0]];
    for (let i = 1; i < hData.length; i++) {
      const hId = Number(hData[i][0]);
      if (hId < 227) {
        validHRows.push(hData[i]);
      }
    }
    hearingSheet.clearContents();
    if (validHRows.length > 0) {
      hearingSheet.getRange(1, 1, validHRows.length, validHRows[0].length).setValues(validHRows);
    }
  }

  return cleanedCount > 0 ? `壊れたビジターデータ ${cleanedCount} 件 (ID 227以降) を自動クリーンアップ削除しました` : null;
}

/**
 * REVO_MEMBERS の初期シード共通処理 (DRY化)
 */
function seedDefaultMembers(membersSheet) {
  if (!membersSheet) return;
  let memberRows = [];
  let id = 1;
  const now = new Date();
  REVO_MEMBERS.forEach(cat => {
    cat.members.forEach(m => {
      memberRows.push([id, cat.category, m.name, m.profession, now]);
      id++;
    });
  });
  if (memberRows.length > 0) {
    membersSheet.getRange(2, 1, memberRows.length, memberRows[0].length).setValues(memberRows);
  }
}

/**
 * 集計・事前キャッシュ保存 (HOTビジター一覧抽出強化)
 */
function updateSummaryCacheTable() {
  initDatabaseSchema();
  cleanupCorruptedVisitorData();

  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);
  const settingsSheet = SheetUtil.getSheet(SHEET_NAMES.SETTINGS);
  const settingSheet = SheetUtil.getSheet(SHEET_NAMES.SETTING_ALT) || SheetUtil.getSheet("Setting");
  const summarySheet = SheetUtil.getSheet(SHEET_NAMES.SUMMARY_CACHE);

  const bniTermsList = generateBniTermsList();

  let startDateStr = "";
  if (settingsSheet && settingsSheet.getLastRow() > 1) {
    const sData = settingsSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      if (sData[i][0] === "start_date" && sData[i][1]) {
        startDateStr = DateUtil.format(sData[i][1], "yyyy/MM/dd");
        break;
      }
    }
  } else if (settingSheet) {
    const val = settingSheet.getRange("B2").getValue();
    if (val) {
      startDateStr = DateUtil.format(val, "yyyy/MM/dd");
    }
  }

  if (!startDateStr) {
    startDateStr = "2025/01/01";
  }

  let startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    startDate = new Date("2025-01-01T00:00:00+09:00");
    startDateStr = "2025/01/01";
  }
  startDate.setHours(0, 0, 0, 0);

  const vData = visitorsSheet && visitorsSheet.getLastRow() > 1 ? visitorsSheet.getDataRange().getValues() : [];
  const sData = statusSheet && statusSheet.getLastRow() > 1 ? statusSheet.getDataRange().getValues() : [];
  const hData = hearingSheet && hearingSheet.getLastRow() > 1 ? hearingSheet.getDataRange().getValues() : [];

  let statusMap = {};
  for (let i = 1; i < sData.length; i++) {
    const r = sData[i];
    statusMap[String(r[0]).trim()] = {
      is_attended: r[1] || "未",
      is_joined: r[2] || "未",
      is_1to1: r[3] || "未",
      is_matched: r[4] || "未",
      matching_note: r[5] || ""
    };
  }

  let hearingMap = {};
  for (let i = 1; i < hData.length; i++) {
    const r = hData[i];
    const vId = String(r[0]).trim();
    if (!vId) continue;
    // 任意の内容入力があるか厳密チェック (orient_user, q1..q7, feel_abc, orient_memo, follow_memo, sheet_url)
    const hasData = r.slice(1, 13).some(val => val !== null && val !== undefined && String(val).trim() !== "");
    hearingMap[vId] = {
      hasSheet: hasData,
      orientUser: r[1] || "",
      q7: r[8] || "",
      feelAbc: parseFeelAbc(r[9]),
      orientMemo: r[10] || "",
      followMemo: r[11] || "",
      url: r[12] || ""
    };
  }

  const nextThu = DateUtil.getNextThursday();
  const afterNextThu = new Date(nextThu.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lastThu = new Date(nextThu.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextThuStr = DateUtil.format(nextThu, "MM/dd");
  const afterNextThuStr = DateUtil.format(afterNextThu, "MM/dd");
  const lastThuStr = DateUtil.format(lastThu, "MM/dd");

  let totalApplyCount = 0;
  let totalJoinedCount = 0;
  let total1to1Count = 0;
  let totalHearingCount = 0;
  let nextThuVisitorCount = 0;
  let afterNextThuVisitorCount = 0;

  let meetingVisitorCountMap = {};
  let weeklyMap = {};
  let monthlyMap = {};
  let nextMeetingVisitors = [];
  let lastMeetingVisitors = [];
  let oneMonthFollowupVisitors = [];
  let hotVisitors = [];

  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (let i = 1; i < vData.length; i++) {
    const row = vData[i];
    const vId = String(row[0]).trim();
    const inviter = String(row[2] || "").trim();
    const eventDateVal = row[3];
    const name = String(row[4] || "").trim();
    const furigana = String(row[5] || "").trim();
    const profession = String(row[6] || "").trim();
    const company = String(row[7] || "").trim();
    const email = String(row[8] || "").trim();
    const attendanceCount = String(row[9] || "初めて").trim();

    if (!vId || (!name && !email)) continue;
    if (!eventDateVal) continue;

    const eventDate = new Date(eventDateVal);
    if (isNaN(eventDate.getTime())) continue;
    eventDate.setHours(0, 0, 0, 0);

    const st = statusMap[vId] || { is_attended: "未", is_joined: "未", is_1to1: "未", is_matched: "未" };
    const hInfo = hearingMap[vId] || { hasSheet: false, orientUser: "", feelAbc: "", q7: "", orientMemo: "", followMemo: "", url: "" };

    if (eventDate >= startDate) {
      totalApplyCount++;

      if (st.is_joined === "入会済" || st.is_joined === true) totalJoinedCount++;
      if (st.is_1to1 === "済" || st.is_1to1 === true) total1to1Count++;
      if (hInfo.hasSheet) totalHearingCount++;

      if (eventDate.getTime() === nextThu.getTime()) nextThuVisitorCount++;
      if (eventDate.getTime() === afterNextThu.getTime()) afterNextThuVisitorCount++;

      const isAttendedBool = (st.is_attended === "参加" || st.is_attended === true);
      const isJoinedBool = (st.is_joined === "入会済" || st.is_joined === "済" || st.is_joined === "入会" || st.is_joined === true);

      const mDateKey = DateUtil.format(eventDate, "yyyy/MM/dd");
      const monthKey = DateUtil.format(eventDate, "yyyy/MM");
      meetingVisitorCountMap[mDateKey] = (meetingVisitorCountMap[mDateKey] || 0) + 1;

      if (!weeklyMap[mDateKey]) {
        weeklyMap[mDateKey] = { date: mDateKey, applyCount: 0, attendedCount: 0, joinedCount: 0 };
      }
      weeklyMap[mDateKey].applyCount++;
      if (isAttendedBool) weeklyMap[mDateKey].attendedCount++;
      if (isJoinedBool) weeklyMap[mDateKey].joinedCount++;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, applyCount: 0, attendedCount: 0, joinedCount: 0 };
      }
      monthlyMap[monthKey].applyCount++;
      if (isAttendedBool) monthlyMap[monthKey].attendedCount++;
      if (isJoinedBool) monthlyMap[monthKey].joinedCount++;

      const visitorRecord = {
        id: vId,
        no: vId,
        inviter: inviter,
        eventDate: DateUtil.format(eventDate, "yyyy/MM/dd"),
        name: name,
        furigana: furigana,
        profession: profession,
        company: company,
        attendanceCount: attendanceCount,
        isAttended: st.is_attended,
        isJoined: st.is_joined,
        is1to1: st.is_1to1,
        matching: st.is_matched,
        hasHearingSheet: hInfo.hasSheet,
        orientUser: hInfo.orientUser,
        feelAbc: hInfo.feelAbc,
        q7: hInfo.q7,
        orientMemo: hInfo.orientMemo,
        hearingUrl: hInfo.url
      };

      const feel = parseFeelAbc(hInfo.feelAbc);
      const isJoined = (st.is_joined === "入会済" || st.is_joined === "済" || st.is_joined === "入会" || st.is_joined === true);
      if (feel === "A" && !isJoined) {
        hotVisitors.push(visitorRecord);
      }

      if (eventDate.getTime() === nextThu.getTime()) {
        nextMeetingVisitors.push(visitorRecord);
      }

      if (eventDate.getTime() === lastThu.getTime()) {
        lastMeetingVisitors.push(visitorRecord);
      }

      if (eventDate >= oneMonthAgo) {
        oneMonthFollowupVisitors.push(visitorRecord);
      }
    }
  }

  hotVisitors = deduplicateVisitorList(hotVisitors);
  nextMeetingVisitors = deduplicateVisitorList(nextMeetingVisitors);
  lastMeetingVisitors = deduplicateVisitorList(lastMeetingVisitors);
  oneMonthFollowupVisitors = deduplicateVisitorList(oneMonthFollowupVisitors);

  hotVisitors.sort((a, b) => {
    if (a.feelAbc !== b.feelAbc) {
      return a.feelAbc.localeCompare(b.feelAbc);
    }
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

  let weeklyStats = Object.values(weeklyMap);
  weeklyStats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let monthlyStats = Object.values(monthlyMap);
  monthlyStats.sort((a, b) => b.month.localeCompare(a.month));
  monthlyStats.forEach(m => {
    m.joinRate = m.applyCount > 0 ? ((m.joinedCount / m.applyCount) * 100).toFixed(1) + "%" : "0.0%";
  });

  let chartLabels = Object.keys(meetingVisitorCountMap);
  chartLabels.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  let chartData = chartLabels.map(k => meetingVisitorCountMap[k]);

  const meetingCount = chartLabels.length || 1;
  const avgVisitorCountNum = (totalApplyCount / meetingCount).toFixed(1);

  const targetJoinGoal = 12;
  const joinRateNum = totalApplyCount > 0 ? ((totalJoinedCount / totalApplyCount) * 100).toFixed(1) : "0.0";
  const achievementRateNum = ((totalJoinedCount / targetJoinGoal) * 100).toFixed(1);
  const hearingRateNum = totalApplyCount > 0 ? ((totalHearingCount / totalApplyCount) * 100).toFixed(1) : "0.0";

  const resultObj = {
    startDateStr: startDateStr,
    bniTermsList: bniTermsList,
    nextThuStr: nextThuStr,
    afterNextThuStr: afterNextThuStr,
    lastThuStr: lastThuStr,
    metrics: {
      applyCount: totalApplyCount,
      joinedCount: totalJoinedCount,
      targetJoinGoal: targetJoinGoal,
      achievementRate: String(achievementRateNum),
      joinRate: String(joinRateNum),
      nextThuCount: nextThuVisitorCount,
      afterNextThuCount: afterNextThuVisitorCount,
      avgVisitorCount: String(avgVisitorCountNum),
      feedbackRate: "0.5",
      hearingRate: String(hearingRateNum),
      hotVisitorCount: hotVisitors.length
    },
    chart: {
      labels: chartLabels,
      data: chartData
    },
    tables: {
      hotVisitors: hotVisitors,
      nextMeeting: nextMeetingVisitors,
      lastMeeting: lastMeetingVisitors,
      oneMonthFollowup: oneMonthFollowupVisitors,
      weeklyStats: weeklyStats,
      monthlyStats: monthlyStats
    }
  };

  const jsonString = JSON.stringify(resultObj);
  if (summarySheet) {
    summarySheet.getRange("A2").setValue(jsonString);
    summarySheet.getRange("B2").setValue(now);
  }

  try {
    CacheService.getScriptCache().put("VHR_DASHBOARD_DATA_CACHE_V7", jsonString, 300);
  } catch (e) {}

  return resultObj;
}

/**
 * 高速キャッシュ取得機能（ミリ秒レスポンスを実現）
 * キャッシュが存在する場合は即座に返し、存在しない場合や強制更新指定時に再構築
 */
function getCachedDashboardData(forceRefresh = false) {
  if (!forceRefresh) {
    // 1. In-Memory Cache (0-5ms)
    try {
      const cachedStr = CacheService.getScriptCache().get("VHR_DASHBOARD_DATA_CACHE_V7");
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }
    } catch (e) {}

    // 2. Summary Cache Sheet (50-100ms)
    try {
      const summarySheet = SheetUtil.getSheet(SHEET_NAMES.SUMMARY_CACHE);
      if (summarySheet && summarySheet.getLastRow() > 1) {
        const val = summarySheet.getRange("A2").getValue();
        if (val) {
          const parsed = JSON.parse(val);
          try {
            CacheService.getScriptCache().put("VHR_DASHBOARD_DATA_CACHE_V7", String(val), 300);
          } catch (e) {}
          return parsed;
        }
      }
    } catch (e) {}
  }

  // 3. Fallback: フル集計＆キャッシュ更新
  return updateSummaryCacheTable();
}

/**
 * 最後にフォーム同期を行った日時を取得
 */
function getLastFormSyncTime() {
  try {
    const settingsSheet = SheetUtil.getSheet(SHEET_NAMES.SETTINGS);
    if (settingsSheet && settingsSheet.getLastRow() > 1) {
      const data = settingsSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === "last_form_sync_time" && data[i][1]) {
          const d = DateUtil.parse(data[i][1]);
          if (d instanceof Date && !isNaN(d.getTime())) return d;
        }
      }
    }
    const propVal = PropertiesService.getScriptProperties().getProperty("LAST_FORM_SYNC_TIME");
    if (propVal) {
      const d = DateUtil.parse(propVal);
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    }
  } catch (e) {}
  return null;
}

/**
 * 最後にフォーム同期を行った日時を保存
 */
function setLastFormSyncTime(syncDate = new Date()) {
  try {
    const dateStr = DateUtil.format(syncDate, "yyyy/MM/dd HH:mm:ss");
    PropertiesService.getScriptProperties().setProperty("LAST_FORM_SYNC_TIME", dateStr);

    const settingsSheet = SheetUtil.getSheet(SHEET_NAMES.SETTINGS);
    if (settingsSheet) {
      if (settingsSheet.getLastRow() <= 1) {
        settingsSheet.appendRow(["last_form_sync_time", dateStr, new Date()]);
      } else {
        const data = settingsSheet.getDataRange().getValues();
        let found = false;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === "last_form_sync_time") {
            settingsSheet.getRange(i + 1, 2).setValue(dateStr);
            settingsSheet.getRange(i + 1, 3).setValue(new Date());
            found = true;
            break;
          }
        }
        if (!found) {
          settingsSheet.appendRow(["last_form_sync_time", dateStr, new Date()]);
        }
      }
    }
  } catch (e) {}
}

/**
 * ListシートからRDBテーブルへの内部同期ロジック (最終同期日時フィルター ＆ 多角重複排除対応)
 */
function syncFormResponsesToRdbInternal() {
  initDatabaseSchema();
  cleanupCorruptedVisitorData();

  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);

  let existingNameSet = new Set();
  let existingKeySet = new Set();
  let maxId = 0;
  const now = new Date();
  let newVisitorRows = [];
  let newStatusRows = [];
  let addedCount = 0;

  // 1. 登録済みビジターの全名簿・メール・キーを多角的に収集して重複を徹底排除
  if (visitorsSheet && visitorsSheet.getLastRow() > 1) {
    const vData = visitorsSheet.getDataRange().getValues();
    for (let i = 1; i < vData.length; i++) {
      const r = vData[i];
      const idNum = Number(r[0]);
      if (!isNaN(idNum) && idNum > maxId) maxId = idNum;

      const name = String(r[4] || "").trim();
      const email = String(r[8] || "").trim();
      const eventDateStr = r[3] ? DateUtil.formatCompact(r[3]) : "";

      if (name) existingNameSet.add(name);
      if (name && eventDateStr) existingKeySet.add(`${name}_${eventDateStr}`);
      if (email && eventDateStr) existingKeySet.add(`${email}_${eventDateStr}`);
    }
  }

  // 2. 最後に同期した日時を取得
  const lastSyncTime = getLastFormSyncTime();
  let latestTimestampFound = lastSyncTime ? new Date(lastSyncTime.getTime()) : null;

  // 動的ヘッダー列マッピング関数の定義
  const buildHeaderMap = (headerRow) => {
    let map = {
      timestamp: 0,
      email: 1,
      inviter: 4,
      name: 5,
      furigana: 6,
      profession: 7,
      eventDate: 8,
      attendanceCount: 9,
      company: 10
    };

    if (Array.isArray(headerRow)) {
      headerRow.forEach((colName, idx) => {
        const s = String(colName || "").trim();
        if (s.includes("タイムスタンプ")) map.timestamp = idx;
        else if (s.includes("メール")) map.email = idx;
        else if (s.includes("招待")) map.inviter = idx;
        else if (s.includes("氏名") || s.includes("お名前")) map.name = idx;
        else if (s.includes("フリガナ") || s.includes("ふりがな")) map.furigana = idx;
        else if (s.includes("専門分野") || s.includes("業種")) map.profession = idx;
        else if (s.includes("参加予定") || s.includes("日程") || s.includes("申込日") || s.includes("参加日")) map.eventDate = idx;
        else if (s.includes("種別") || s.includes("参加回数") || s.includes("何回目")) map.attendanceCount = idx;
        else if (s.includes("会社名") || s.includes("屋号")) map.company = idx;
      });
    }
    return map;
  };

  const rSheet = SheetUtil.getSheet(SHEET_NAMES.LIST) || SheetUtil.getSheet(SHEET_NAMES.RAW_FORM);
  if (rSheet && rSheet.getLastRow() > 1) {
    const rawData = rSheet.getDataRange().getValues();
    const headerMap = buildHeaderMap(rawData[0]);

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const name = String(row[headerMap.name] || "").trim();
      const email = String(row[headerMap.email] || "").trim();
      const inviter = String(row[headerMap.inviter] || "").trim();
      const furigana = String(row[headerMap.furigana] || "").trim();
      const profession = String(row[headerMap.profession] || "").trim();
      const company = String(row[headerMap.company] || "").trim();
      const attendanceCount = String(row[headerMap.attendanceCount] || "初めて").trim();
      const rawEventDate = row[headerMap.eventDate];
      const rawTimestamp = row[headerMap.timestamp];

      // ヘッダー行や不正値の徹底弾き
      if (!name || name.includes("氏名") || name.includes("タイムスタンプ") || name.includes("招待者") || name.includes("ZOOM") || name.includes("チャプター名")) {
        continue;
      }

      // タイムスタンプの判定
      const createdAt = (rawTimestamp && DateUtil.parse(rawTimestamp)) ? DateUtil.parse(rawTimestamp) : now;

      // 前回同期日時より古いレコードはスキップ (初回同期でない場合のみ)
      if (lastSyncTime && createdAt <= lastSyncTime) {
        continue;
      }

      // 日付の正規化パース ＆ 1970年・無効日付の徹底除外
      const eventDate = DateUtil.parse(rawEventDate);
      if (!eventDate || isNaN(eventDate.getTime()) || eventDate.getFullYear() < 2020) {
        continue;
      }

      const eventDateStr = DateUtil.formatCompact(eventDate);

      // 重複チェック (氏名重複、氏名+参加日、メール+参加日)
      const isDuplicate = existingNameSet.has(name) ||
                          existingKeySet.has(`${name}_${eventDateStr}`) ||
                          (email && existingKeySet.has(`${email}_${eventDateStr}`));

      if (isDuplicate) {
        continue;
      }

      maxId++;
      const newVisitorId = String(maxId);

      newVisitorRows.push([newVisitorId, createdAt, inviter, eventDate, name, furigana, profession, company, email, attendanceCount, ""]);
      newStatusRows.push([newVisitorId, "未", "未", "未", "未", "", now]);

      existingNameSet.add(name);
      if (name && eventDateStr) existingKeySet.add(`${name}_${eventDateStr}`);
      if (email && eventDateStr) existingKeySet.add(`${email}_${eventDateStr}`);

      addedCount++;

      if (!latestTimestampFound || createdAt > latestTimestampFound) {
        latestTimestampFound = createdAt;
      }
    }
  }

  if (newVisitorRows.length > 0 && visitorsSheet) {
    visitorsSheet.getRange(visitorsSheet.getLastRow() + 1, 1, newVisitorRows.length, newVisitorRows[0].length).setValues(newVisitorRows);
  }
  if (newStatusRows.length > 0 && statusSheet) {
    statusSheet.getRange(statusSheet.getLastRow() + 1, 1, newStatusRows.length, newStatusRows[0].length).setValues(newStatusRows);
  }

  // 最終同期日時を更新保存
  if (latestTimestampFound || newVisitorRows.length > 0) {
    setLastFormSyncTime(latestTimestampFound || now);
  } else if (!lastSyncTime) {
    setLastFormSyncTime(now);
  }

  return addedCount;
}

/**
 * ListシートからRDBテーブルへの同期 (公開API/手動ボタン用)
 */
function syncFormResponsesToRdb() {
  const lastTime = getLastFormSyncTime();
  const addedCount = syncFormResponsesToRdbInternal();
  updateSummaryCacheTable();

  const lastTimeStr = lastTime ? DateUtil.format(lastTime, "yyyy/MM/dd HH:mm") : "初回";
  return {
    success: true,
    addedCount: addedCount,
    message: addedCount > 0
      ? `同期完了: 前回同期（${lastTimeStr}）以降の新着ビジター ${addedCount} 件を追加登録しました。`
      : `新着データはありません（前回同期: ${lastTimeStr}。登録済みビジターは重複防止のためスキップされました）。`
  };
}

/**
 * 【定期自動同期エンジン】スプレッドシートを定期チェックし、新着データの自動取り込み・整合性修復・高速キャッシュ更新を全自動で行う
 */
function autoCheckAndSyncSheets() {
  try {
    initDatabaseSchema();
    // 1. Googleフォーム/Listシートからの新着回答全自動同期
    const addedCount = syncFormResponsesToRdbInternal();
    // 2. データフォーマット検証とヘッダー整合性修復
    runDataFormatCheckAndRepair();
    // 3. 最新集計結果の高速キャッシュ構築
    const updatedSummary = updateSummaryCacheTable();

    Logger.log(`[自動定期同期完了] 新着追加: ${addedCount}件 / タイムスタンプ: ${new Date()}`);
    return { success: true, addedCount: addedCount, summary: updatedSummary };
  } catch (err) {
    Logger.log(`[自動定期同期エラー] ${err.stack || err}`);
    return { success: false, error: String(err) };
  }
}

/**
 * 過去データの一括移行
 */
function migrateLegacyDataToRdb() {
  initDatabaseSchema();

  const rawSheet = SheetUtil.getSheet(SHEET_NAMES.LIST) || SheetUtil.getSheet(SHEET_NAMES.RAW_FORM) || SheetUtil.getSheet(SHEET_NAMES.TOTAL);
  if (!rawSheet) return "No List/Total sheet found to migrate.";

  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);

  const rawData = rawSheet.getDataRange().getValues();
  if (rawData.length <= 1) return "No data to migrate.";

  visitorsSheet.getRange(2, 1, Math.max(1, visitorsSheet.getLastRow()), 11).clearContent();
  statusSheet.getRange(2, 1, Math.max(1, statusSheet.getLastRow()), 7).clearContent();

  let visitorsRows = [];
  let statusRows = [];
  let hearingRows = [];

  const now = new Date();
  let autoId = 1;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const vf = RowParser.extractVisitorFields(row, now);
    if (!vf || (!vf.name && !vf.email)) continue;
    if (vf.name.includes("氏名") || vf.name.includes("タイムスタンプ")) continue;

    const visitorId = String(row[0] && typeof row[0] === 'number' ? row[0] : autoId);
    autoId++;

    const eventDate = DateUtil.parse(vf.eventDateVal);
    visitorsRows.push([visitorId, vf.createdAt, vf.inviter, eventDate, vf.name, vf.furigana, vf.profession, vf.company, vf.email, vf.attendanceCount, ""]);

    let isAttended = "未";
    if (row[COL.IS_ATTENDED] === true) isAttended = "参加";
    if (row[COL.IS_ABSENT] === true) isAttended = "不参加";

    statusRows.push([visitorId, isAttended, row[COL.IS_JOINED] === true ? "入会済" : "未", row[COL.IS_1TO1] === true ? "済" : "未", row[COL.MATCHING_REQ] || (row[COL.IS_MATCHED] === true ? "成功" : "未"), "", now]);

    const hearingUrl = String(row[COL.HEARING_SHEET] || "").trim();
    if (hearingUrl) {
      hearingRows.push([visitorId, "", "", "", "", "", "", "", "", "", "", "", hearingUrl, now]);
    }
  }

  if (visitorsRows.length > 0) {
    visitorsSheet.getRange(2, 1, visitorsRows.length, visitorsRows[0].length).setValues(visitorsRows);
  }
  if (statusRows.length > 0) {
    statusSheet.getRange(2, 1, statusRows.length, statusRows[0].length).setValues(statusRows);
  }
  if (hearingRows.length > 0) {
    hearingSheet.getRange(2, 1, hearingRows.length, hearingRows[0].length).setValues(hearingRows);
  }

  updateSummaryCacheTable();
  return `Precision Migration Completed: ${visitorsRows.length} visitors imported.`;
}

/**
 * 同一ビジター（メールアドレスまたは氏名が一致）の重複レコードを最新の1件に統合し、参加回数を保持する
 */
function deduplicateVisitorList(list) {
  if (!list || list.length === 0) return [];
  const map = new Map();

  list.forEach(r => {
    const emailKey = r.email ? String(r.email).toLowerCase().trim() : '';
    const nameKey = r.name ? String(r.name).replace(/[\s\u3000]+/g, '') : '';
    const key = emailKey || nameKey || String(r.id || r.no);

    if (!map.has(key)) {
      map.set(key, { ...r, historyCount: 1 });
    } else {
      const existing = map.get(key);
      existing.historyCount = (existing.historyCount || 1) + 1;

      const tExisting = new Date(existing.eventDate || 0).getTime();
      const tNew = new Date(r.eventDate || 0).getTime();

      if (tNew >= tExisting) {
        map.set(key, {
          ...r,
          historyCount: existing.historyCount,
          hasHearingSheet: existing.hasHearingSheet || r.hasHearingSheet,
          is1to1: (existing.is1to1 === '済' || r.is1to1 === '済') ? '済' : (r.is1to1 || existing.is1to1),
          isJoined: (existing.isJoined === '入会済' || r.isJoined === '入会済') ? '入会済' : (r.isJoined || existing.isJoined),
          q7: r.q7 || existing.q7,
          orientUser: r.orientUser || existing.orientUser,
          orientMemo: r.orientMemo || existing.orientMemo
        });
      } else {
        existing.hasHearingSheet = existing.hasHearingSheet || r.hasHearingSheet;
        if (r.is1to1 === '済') existing.is1to1 = '済';
        if (r.isJoined === '入会済') existing.isJoined = '入会済';
        if (!existing.q7 && r.q7) existing.q7 = r.q7;
        if (!existing.orientUser && r.orientUser) existing.orientUser = r.orientUser;
        if (!existing.orientMemo && r.orientMemo) existing.orientMemo = r.orientMemo;
      }
    }
  });

  return Array.from(map.values());
}
