/**
 * Visitor Host Revolution 2.0
 * Web App エントリーポイント ＆ メンバーマスター自動シード・CRUD API
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.api === 'export') {
    const allVisitorsRes = getAllVisitorsApi();
    const hearingsRes = getHearingSheetsListApi();
    const membersRes = getMemberListApi();
    const dashboardData = getDashboardData();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      visitors: allVisitorsRes.list || [],
      hearings: hearingsRes.list || [],
      members: membersRes.flatMembers || [],
      dashboardData: dashboardData
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.initialVisitorId = (e && e.parameter && e.parameter.id) ? String(e.parameter.id) : "";

  try {
    const dashboardData = getDashboardData();
    template.initialDataJson = JSON.stringify({ dashboardData: dashboardData });
  } catch (err) {
    template.initialDataJson = JSON.stringify({});
  }

  return template.evaluate()
    .setTitle('REvo 定例会ビジター管理ダッシュボード 2.0')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Web App HTTP POST Webhook エントリーポイント (Webサーバーからの出欠同期等)
 */
function doPost(e) {
  try {
    let contents = {};
    if (e && e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (err) {
        contents = e.parameter || {};
      }
    } else if (e && e.parameter) {
      contents = e.parameter;
    }

    const action = contents.action || (e && e.parameter ? e.parameter.action : '');

    if (action === 'update_status') {
      const visitorId = contents.visitorId;
      const field = contents.field;
      const value = contents.value;
      const res = updateVisitorStatusApi(visitorId, field, value);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Unknown action: ' + action })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * 高速初期ロード用：サーバーサイドで初回表示に必要なデータを一括生成（高速キャッシュ活用）
 */
function getFastInitialData() {
  const dashboardData = getCachedDashboardData();
  const memberRes = getMemberListApi();

  return {
    dashboardData: dashboardData,
    memberCategories: memberRes.memberCategories || [],
    flatMembers: memberRes.flatMembers || [],
    isTestMode: IS_TEST_MODE,
    testEmailList: TEST_EMAIL_LIST
  };
}

/**
 * ダッシュボード用データ取得 (高速キャッシュ活用 ＆ 必要時強制更新対応)
 */
function getDashboardData(forceRefresh = false) {
  return getCachedDashboardData(forceRefresh);
}

/**
 * 【Web UI API】メール送信予定一覧の取得
 */
function getScheduledEmailsApi() {
  const list = calculateScheduledEmailsList();
  
  const todayCount = list.filter(item => item.daysRemaining === 0).length;
  const thisWeekCount = list.filter(item => item.daysRemaining >= 0 && item.daysRemaining <= 7).length;
  
  return {
    success: true,
    scheduledList: list,
    metrics: {
      totalCount: list.length,
      todayCount: todayCount,
      thisWeekCount: thisWeekCount
    },
    isTestMode: IS_TEST_MODE,
    testEmailList: TEST_EMAIL_LIST
  };
}

/**
 * 【Web UI API】members テーブルから全フラットメンバー一覧の取得 (空なら自動初期プリセット)
 */
function getMemberListApi() {
  initDatabaseSchema();
  const membersSheet = SheetUtil.getSheet(SHEET_NAMES.MEMBERS);
  if (!membersSheet) return { success: false, message: "members sheet not found" };

  if (membersSheet.getLastRow() <= 1) {
    seedDefaultMembers(membersSheet);
  }

  let categoriesMap = {};
  let categoryOrder = [];
  let flatMembersList = [];

  const data = membersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const mId = String(r[0]);
    const cat = String(r[1] || "その他").trim();
    const name = String(r[2] || "").trim();
    const prof = String(r[3] || "").trim();

    if (!name) continue;

    flatMembersList.push({ id: mId, category: cat, name: name, profession: prof });

    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
      categoryOrder.push(cat);
    }
    categoriesMap[cat].push({ id: mId, name: name, profession: prof });
  }

  const result = categoryOrder.map(cat => ({
    category: cat,
    members: categoriesMap[cat]
  }));

  return { success: true, memberCategories: result, flatMembers: flatMembersList };
}

/**
 * 【Web UI API】メンバーマスターCRUD: 追加 API
 */
function addMemberApi(mObj) {
  initDatabaseSchema();
  const membersSheet = SheetUtil.getSheet(SHEET_NAMES.MEMBERS);
  if (!membersSheet) return { success: false, message: "members sheet not found" };

  const lastRow = membersSheet.getLastRow();
  const newId = lastRow > 1 ? Number(membersSheet.getRange(lastRow, 1).getValue()) + 1 : 1;
  const now = new Date();

  membersSheet.appendRow([
    newId,
    mObj.category || "その他",
    mObj.name || "",
    mObj.profession || "",
    now
  ]);

  return getMemberListApi();
}

/**
 * 【Web UI API】メンバーマスターCRUD: 更新 API
 */
function updateMemberApi(mObj) {
  const membersSheet = SheetUtil.getSheet(SHEET_NAMES.MEMBERS);
  if (!membersSheet) return { success: false, message: "members sheet not found" };

  const data = membersSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(mObj.id).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow <= 0) return { success: false, message: "Member not found" };

  const now = new Date();
  membersSheet.getRange(targetRow, 2).setValue(mObj.category || "その他");
  membersSheet.getRange(targetRow, 3).setValue(mObj.name || "");
  membersSheet.getRange(targetRow, 4).setValue(mObj.profession || "");
  membersSheet.getRange(targetRow, 5).setValue(now);

  return getMemberListApi();
}

/**
 * 【Web UI API】メンバーマスターCRUD: 削除 API
 */
function deleteMemberApi(memberId) {
  const membersSheet = SheetUtil.getSheet(SHEET_NAMES.MEMBERS);
  if (!membersSheet) return { success: false, message: "members sheet not found" };

  const data = membersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(memberId).trim()) {
      membersSheet.deleteRow(i + 1);
      break;
    }
  }

  return getMemberListApi();
}


/**
 * 【Web UI API】ビジター詳細プロファイルの取得 (自由メモ含む)
 */
function getVisitorDetailApi(visitorId) {
  if (!visitorId) return { success: false, message: "Visitor ID is empty" };
  const targetId = String(visitorId).replace(/^visitor\//, '').trim();
  if (!targetId) return { success: false, message: "Invalid Visitor ID" };

  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);
  const mailSheet = SheetUtil.getSheet(SHEET_NAMES.MAIL_HISTORIES);

  let visitorInfo = null;

  if (visitorsSheet && visitorsSheet.getLastRow() > 1) {
    const vData = visitorsSheet.getDataRange().getValues();
    for (let i = 1; i < vData.length; i++) {
      if (String(vData[i][0]).trim() === targetId) {
        const r = vData[i];
        visitorInfo = {
          id: String(r[0]),
          createdAt: DateUtil.format(r[1], "yyyy/MM/dd HH:mm"),
          inviter: r[2] || "",
          eventDate: DateUtil.format(r[3], "yyyy/MM/dd"),
          name: r[4] || "",
          furigana: r[5] || "",
          profession: r[6] || "",
          company: r[7] || "",
          email: r[8] || "",
          attendanceCount: r[9] || "初めて",
          remarks: r[10] || ""
        };
        break;
      }
    }
  }

  if (!visitorInfo) return { success: false, message: "Visitor not found" };

  let statusInfo = { isAttended: "未", isJoined: "未", is1to1: "未", matching: "未", matchingNote: "" };
  if (statusSheet && statusSheet.getLastRow() > 1) {
    const sData = statusSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      if (String(sData[i][0]).trim() === String(visitorId).trim()) {
        const r = sData[i];
        statusInfo = {
          isAttended: r[1] || "未",
          isJoined: r[2] || "未",
          is1to1: r[3] || "未",
          matching: r[4] || "未",
          matchingNote: r[5] || ""
        };
        break;
      }
    }
  }

  let hearingInfo = null;
  if (hearingSheet && hearingSheet.getLastRow() > 1) {
    const hData = hearingSheet.getDataRange().getValues();
    for (let i = 1; i < hData.length; i++) {
      if (String(hData[i][0]).trim() === String(visitorId).trim()) {
        const r = hData[i];
        hearingInfo = {
          orientUser: r[1] || "",
          q1: r[2] || "",
          q2: r[3] || "",
          q3: r[4] || "",
          q4: r[5] || "",
          q5: r[6] || "",
          q6: r[7] || "",
          q7: r[8] || "",
          feelAbc: parseFeelAbc(r[9]),
          orientMemo: r[10] || "",
          followMemo: r[11] || "",
          sheetUrl: r[12] || "",
          updatedAt: DateUtil.format(r[13], "yyyy/MM/dd HH:mm")
        };
        break;
      }
    }
  }

  let mailLogs = [];
  if (mailSheet && mailSheet.getLastRow() > 1) {
    const mData = mailSheet.getDataRange().getValues();
    for (let i = 1; i < mData.length; i++) {
      if (String(mData[i][0]).trim() === String(visitorId).trim()) {
        const r = mData[i];
        mailLogs.push({
          mailType: r[1] || "",
          sentAt: DateUtil.format(r[2], "yyyy/MM/dd HH:mm"),
          status: r[3] || "送信済"
        });
      }
    }
  }

  if (mailLogs.length === 0) {
    mailLogs.push({ mailType: "登録完了・案内メール (Welcome)", sentAt: visitorInfo.createdAt || visitorInfo.eventDate, status: "自動送信完了" });
    mailLogs.push({ mailType: "定例会 前日リマインドメール", sentAt: visitorInfo.eventDate + " 前日", status: "スケジュール済み" });
  }

  return {
    success: true,
    visitor: visitorInfo,
    status: statusInfo,
    hearing: hearingInfo,
    mailLogs: mailLogs,
    webAppUrl: ScriptApp.getService().getUrl()
  };
}

/**
 * 【Web UI API】ビジター詳細プロファイル画面からの自由メモ保存 API
 */
function saveVisitorMemoApi(visitorId, memoText) {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  if (!visitorsSheet) return { success: false, message: "visitors sheet not found" };

  const data = visitorsSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(visitorId).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow <= 0) return { success: false, message: "Visitor not found" };

  visitorsSheet.getRange(targetRow, 11).setValue(memoText || "");

  updateSummaryCacheTable();
  return { success: true, visitorId: visitorId, memo: memoText };
}

/**
 * 【Web UI API】Googleフォーム回答 (Listシート) を手動同期
 */
function syncFormResponsesApi() {
  const msg = syncFormResponsesToRdb();
  const data = getDashboardData();
  return { success: true, message: msg, data: data };
}

/**
 * 【CRUD: Create】新規ビジターの手動追加 API
 */
function addVisitorApi(vData) {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);

  if (!visitorsSheet || !statusSheet) return { success: false, message: "Sheet not found" };

  const lastRow = visitorsSheet.getLastRow();
  const newId = String(lastRow > 1 ? Number(visitorsSheet.getRange(lastRow, 1).getValue()) + 1 : 1);
  const now = new Date();

  const eventDate = DateUtil.parse(vData.eventDate);

  visitorsSheet.appendRow([
    newId,
    now,
    vData.inviter || "",
    eventDate,
    vData.name || "",
    vData.furigana || "",
    vData.profession || "",
    vData.company || "",
    vData.email || "",
    vData.attendanceCount || "初めて",
    vData.remarks || ""
  ]);

  statusSheet.appendRow([newId, "未", "未", "未", "未", "", now]);

  updateSummaryCacheTable();
  return { success: true, visitorId: newId };
}

/**
 * 【CRUD: Update】ビジター情報の更新 API
 */
function updateVisitorApi(vData) {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  if (!visitorsSheet) return { success: false, message: "visitors sheet not found" };

  const data = visitorsSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(vData.id).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow <= 0) return { success: false, message: "Visitor not found" };

  const eventDate = DateUtil.parse(vData.eventDate);

  visitorsSheet.getRange(targetRow, 3).setValue(vData.inviter || "");
  visitorsSheet.getRange(targetRow, 4).setValue(eventDate);
  visitorsSheet.getRange(targetRow, 5).setValue(vData.name || "");
  visitorsSheet.getRange(targetRow, 6).setValue(vData.furigana || "");
  visitorsSheet.getRange(targetRow, 7).setValue(vData.profession || "");
  visitorsSheet.getRange(targetRow, 8).setValue(vData.company || "");
  visitorsSheet.getRange(targetRow, 9).setValue(vData.email || "");
  visitorsSheet.getRange(targetRow, 10).setValue(vData.attendanceCount || "初めて");
  visitorsSheet.getRange(targetRow, 11).setValue(vData.remarks || "");

  updateSummaryCacheTable();
  return { success: true, visitorId: vData.id };
}

/**
 * 【CRUD: Delete】ビジターデータの削除 API
 */
function deleteVisitorApi(visitorId) {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);

  if (visitorsSheet) {
    const vData = visitorsSheet.getDataRange().getValues();
    for (let i = 1; i < vData.length; i++) {
      if (String(vData[i][0]).trim() === String(visitorId).trim()) {
        visitorsSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  if (statusSheet) {
    const sData = statusSheet.getDataRange().getValues();
    for (let i = 1; i < sData.length; i++) {
      if (String(sData[i][0]).trim() === String(visitorId).trim()) {
        statusSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  updateSummaryCacheTable();
  return { success: true, visitorId: visitorId };
}

/**
 * 【Web UI API】全ビジター一覧の取得
 */
function getAllVisitorsApi() {
  try {
    const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
    const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
    const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);

    const vData = visitorsSheet && visitorsSheet.getLastRow() > 1 ? visitorsSheet.getDataRange().getValues() : [];
    const sData = statusSheet && statusSheet.getLastRow() > 1 ? statusSheet.getDataRange().getValues() : [];
    const hData = hearingSheet && hearingSheet.getLastRow() > 1 ? hearingSheet.getDataRange().getValues() : [];

    let statusMap = {};
    for (let i = 1; i < sData.length; i++) {
      const r = sData[i];
      if (r[0] !== undefined && r[0] !== null) {
        statusMap[String(r[0]).trim()] = {
          is_attended: r[1] || "未",
          is_joined: r[2] || "未",
          is_1to1: r[3] || "未",
          is_matched: r[4] || "未"
        };
      }
    }

    let hearingMap = {};
    for (let i = 1; i < hData.length; i++) {
      const r = hData[i];
      const vId = String(r[0] || "").trim();
      if (!vId) continue;
      const hasData = r.slice(1, 13).some(val => val !== null && val !== undefined && String(val).trim() !== "");
      hearingMap[vId] = { hasSheet: hasData, url: r[12] || "" };
    }

    let list = [];
    for (let i = 1; i < vData.length; i++) {
      const r = vData[i];
      const vId = String(r[0] || "").trim();
      const name = String(r[4] || "").trim();
      const email = String(r[8] || "").trim();
      if (!vId || (!name && !email) || name.includes("氏名") || name.includes("タイムスタンプ")) continue;

      const st = statusMap[vId] || { is_attended: "未", is_joined: "未", is_1to1: "未", is_matched: "未" };
      const hInfo = hearingMap[vId] || { hasSheet: false, url: "" };

      list.push({
        id: vId,
        no: vId,
        createdDate: DateUtil.format(r[1], "yyyy/MM/dd"),
        inviter: String(r[2] || ""),
        eventDate: DateUtil.format(r[3], "yyyy/MM/dd"),
        name: name,
        furigana: String(r[5] || ""),
        profession: String(r[6] || ""),
        company: String(r[7] || ""),
        email: email,
        attendanceCount: String(r[9] || "初めて"),
        remarks: String(r[10] || ""),
        isAttended: st.is_attended,
        isJoined: st.is_joined,
        is1to1: st.is_1to1,
        matching: st.is_matched,
        hasHearingSheet: hInfo.hasSheet,
        hearingUrl: hInfo.url
      });
    }

    list.sort((a, b) => {
      const da = DateUtil.parse(a.eventDate);
      const db = DateUtil.parse(b.eventDate);
      const ta = (da instanceof Date && !isNaN(da.getTime())) ? da.getTime() : 0;
      const tb = (db instanceof Date && !isNaN(db.getTime())) ? db.getTime() : 0;
      return tb - ta; // 参加日の最新順
    });
    return { success: true, list: list };
  } catch (e) {
    Logger.log("getAllVisitorsApi Error: " + e);
    return { success: false, message: String(e), list: [] };
  }
}

/**
 * 【Web UI API】ヒアリングシート回答一覧の取得
 */
function getHearingSheetsListApi() {
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);

  const vData = visitorsSheet && visitorsSheet.getLastRow() > 1 ? visitorsSheet.getDataRange().getValues() : [];
  const sData = statusSheet && statusSheet.getLastRow() > 1 ? statusSheet.getDataRange().getValues() : [];
  const hData = hearingSheet && hearingSheet.getLastRow() > 1 ? hearingSheet.getDataRange().getValues() : [];

  let statusMap = {};
  for (let i = 1; i < sData.length; i++) {
    const r = sData[i];
    statusMap[String(r[0]).trim()] = {
      is_attended: r[1] || "未",
      is_joined: r[2] || "未",
      is_1to1: r[3] || "未"
    };
  }

  let vMap = {};
  for (let i = 1; i < vData.length; i++) {
    const r = vData[i];
    const key = String(r[0]).trim();
    if (!key) continue;
    vMap[key] = {
      name: r[4] || "",
      company: r[7] || "",
      profession: r[6] || "",
      inviter: r[2] || "",
      eventDate: DateUtil.format(r[3], "yyyy/MM/dd")
    };
  }

  let list = [];
  for (let i = 1; i < hData.length; i++) {
    const r = hData[i];
    const vId = String(r[0]).trim();
    if (!vId) continue;

    // 空のプレースホルダー行をスキップし、実際に回答データが存在する行のみ抽出
    const hasData = r.slice(1, 13).some(val => val !== null && val !== undefined && String(val).trim() !== "");
    if (!hasData) continue;

    const vInfo = vMap[vId] || {};
    const st = statusMap[vId] || { is_attended: "未", is_joined: "未", is_1to1: "未" };
    const displayName = (vInfo.name && String(vInfo.name).trim() !== "") ? vInfo.name : (r[1] || "ビジター ID:" + vId);
    const displayDate = vInfo.eventDate || DateUtil.format(r[13], "yyyy/MM/dd");

    list.push({
      visitorId: vId,
      name: displayName,
      company: vInfo.company || "",
      profession: vInfo.profession || "",
      inviter: vInfo.inviter || "",
      eventDate: displayDate,
      orientUser: r[1] || "",
      q1: r[2] || "",
      q2: r[3] || "",
      q3: r[4] || "",
      q4: r[5] || "",
      q5: r[6] || "",
      q6: r[7] || "",
      q7: r[8] || "",
      feelAbc: parseFeelAbc(r[9]),
      orientMemo: r[10] || "",
      followMemo: r[11] || "",
      sheetUrl: r[12] || "",
      updatedAt: DateUtil.format(r[13], "yyyy/MM/dd HH:mm"),
      isAttended: st.is_attended,
      isJoined: st.is_joined,
      is1to1: st.is_1to1
    });
  }

  list = deduplicateVisitorList(list);

  // 最新の更新日時順（またはイベント日付順）にソート
  list.sort((a, b) => {
    const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.eventDate ? new Date(a.eventDate).getTime() : 0);
    const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.eventDate ? new Date(b.eventDate).getTime() : 0);
    return tB - tA;
  });

  return { success: true, list: list };
}

/**
 * 【Web UI Setting API】BNIの期別スタート期間を変更
 */
function updateSettingStartDateApi(startDateStr) {
  const settingsSheet = SheetUtil.getSheet(SHEET_NAMES.SETTINGS);
  if (settingsSheet) {
    const data = settingsSheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === "start_date") {
        targetRow = i + 1;
        break;
      }
    }
    const now = new Date();
    if (targetRow > 0) {
      settingsSheet.getRange(targetRow, 2).setValue(startDateStr);
      settingsSheet.getRange(targetRow, 3).setValue(now);
    } else {
      settingsSheet.appendRow(["start_date", startDateStr, now]);
    }
  }

  const settingSheet = SheetUtil.getSheet(SHEET_NAMES.SETTING_ALT) || SheetUtil.getSheet("Setting");
  if (settingSheet) {
    settingSheet.getRange("B2").setValue(startDateStr);
  }

  const newSummaryObj = updateSummaryCacheTable();
  return { success: true, startDateStr: startDateStr, data: newSummaryObj };
}

/**
 * 【Web UI API】ビジターのヒアリングフォームデータの取得
 */
function getHearingFormDataApi(visitorId) {
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);

  let vInfo = { visitor_name: "", inviter: "", company: "", profession: "", event_date: "" };

  if (visitorsSheet && visitorsSheet.getLastRow() > 1) {
    const vData = visitorsSheet.getDataRange().getValues();
    for (let i = 1; i < vData.length; i++) {
      if (String(vData[i][0]).trim() === String(visitorId).trim()) {
        vInfo.inviter = vData[i][2] || "";
        vInfo.event_date = DateUtil.format(vData[i][3], "yyyy/MM/dd");
        vInfo.visitor_name = vData[i][4] || "";
        vInfo.profession = vData[i][6] || "";
        vInfo.company = vData[i][7] || "";
        break;
      }
    }
  }

  let formData = {
    visitorId: visitorId,
    orientUser: "",
    q1: "", q2: "", q3: "", q4: "", q5: "", q6: "", q7: "",
    feelAbc: "",
    orientMemo: "",
    followMemo: "",
    sheetUrl: ""
  };

  if (hearingSheet && hearingSheet.getLastRow() > 1) {
    const hData = hearingSheet.getDataRange().getValues();
    for (let i = 1; i < hData.length; i++) {
      if (String(hData[i][0]).trim() === String(visitorId).trim()) {
        const r = hData[i];
        formData.orientUser = r[1] || "";
        formData.q1 = r[2] || "";
        formData.q2 = r[3] || "";
        formData.q3 = r[4] || "";
        formData.q4 = r[5] || "";
        formData.q5 = r[6] || "";
        formData.q6 = r[7] || "";
        formData.q7 = r[8] || "";
        formData.feelAbc = parseFeelAbc(r[9]);
        formData.orientMemo = r[10] || "";
        formData.followMemo = r[11] || "";
        formData.sheetUrl = r[12] || "";
        break;
      }
    }
  }

  const memberRes = getMemberListApi();
  return { success: true, visitorInfo: vInfo, formData: formData, memberCategories: memberRes.memberCategories };
}

/**
 * 【Web UI API】ヒアリングフォームデータの一括保存
 */
function saveHearingFormApi(formData) {
  const hearingSheet = SheetUtil.getSheet(SHEET_NAMES.HEARING_SHEETS);
  if (!hearingSheet) return { success: false, message: "hearing_sheets not found" };

  const data = hearingSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(formData.visitorId).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  const now = new Date();
  const rowVals = [
    formData.visitorId,
    formData.orientUser || "",
    formData.q1 || "",
    formData.q2 || "",
    formData.q3 || "",
    formData.q4 || "",
    formData.q5 || "",
    formData.q6 || "",
    formData.q7 || "",
    formData.feelAbc || "",
    formData.orientMemo || "",
    formData.followMemo || "",
    formData.sheetUrl || "",
    now
  ];

  if (targetRow > 0) {
    hearingSheet.getRange(targetRow, 1, 1, rowVals.length).setValues([rowVals]);
  } else {
    hearingSheet.appendRow(rowVals);
  }

  updateSummaryCacheTable();
  return { success: true, visitorId: formData.visitorId };
}

/**
 * クライアント側（ブラウザ）で発生したエラーをGASログに記録するリモートエラーキャッチャー
 */
function logClientErrorApi(errorInfo) {
  console.error("🚨 【ブラウザ側JSエラー検出】", JSON.stringify(errorInfo));
  return { success: true };
}

/**
 * 【Web UI API】出欠・ステータス更新 (visitors_status 及び Totalシートへ連携)
 */
function updateVisitorStatusApi(visitorId, fieldName, value) {
  const statusSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS_STATUS);
  if (!statusSheet) return { success: false, message: "Status sheet not found" };

  const data = statusSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(visitorId).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  const colMap = { isAttended: 2, isJoined: 3, is1to1: 4, matching: 5 };
  const colIdx = colMap[fieldName];
  if (!colIdx) return { success: false, message: "Invalid field name" };

  const now = new Date();

  if (targetRow > 0) {
    statusSheet.getRange(targetRow, colIdx).setValue(value);
    statusSheet.getRange(targetRow, 7).setValue(now);
  } else {
    let rowVals = [visitorId, "未", "未", "未", "未", "", now];
    rowVals[colIdx - 1] = value;
    statusSheet.appendRow(rowVals);
  }

  // Totalシートが存在する場合はTotalシートへも連携同期
  try {
    const totalSheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
    if (totalSheet && totalSheet.getLastRow() > 1) {
      const totalData = totalSheet.getDataRange().getValues();
      for (let j = 1; j < totalData.length; j++) {
        if (String(totalData[j][0]).trim() === String(visitorId).trim()) {
          const tRow = j + 1;
          if (fieldName === 'isAttended') {
            if (value === '出席' || value === '参加') {
              totalSheet.getRange(tRow, COL.IS_ATTENDED + 1).setValue('参加');
              totalSheet.getRange(tRow, COL.IS_ABSENT + 1).setValue('');
            } else if (value === '欠席') {
              totalSheet.getRange(tRow, COL.IS_ATTENDED + 1).setValue('');
              totalSheet.getRange(tRow, COL.IS_ABSENT + 1).setValue('欠席');
            } else {
              totalSheet.getRange(tRow, COL.IS_ATTENDED + 1).setValue('');
              totalSheet.getRange(tRow, COL.IS_ABSENT + 1).setValue('');
            }
          } else if (fieldName === 'isJoined') {
            totalSheet.getRange(tRow, COL.IS_JOINED + 1).setValue(value === '入会' || value === '入会済' ? '済' : '');
          }
          break;
        }
      }
    }
  } catch (errSync) {
    console.warn("Failed to sync to Total sheet: " + errSync);
  }

  updateSummaryCacheTable();
  return { success: true, visitorId: visitorId, field: fieldName, value: value };
}

function clearDashboardCache() {
  updateSummaryCacheTable();
}

function getNextThursdayDate() {
  return DateUtil.getNextThursday();
}

/**
 * 【Web UI API】スプレッドシート全体のフォーマットを検査・自動修復
 */
function checkAndRepairDataFormatApi() {
  const result = runDataFormatCheckAndRepair();
  return result;
}

/**
 * 【Web UI API】手動フォーム同期API
 */
function syncFormResponsesApi() {
  const result = syncFormResponsesToRdb();
  const dashboardData = updateSummaryCacheTable();
  return {
    success: true,
    addedCount: result.addedCount,
    message: result.message,
    data: dashboardData
  };
}
