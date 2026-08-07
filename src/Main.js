/**
 * Visitor Host Revolution 2.0 - メイン自動化 ＆ メール・LINE自動送信統括エンジン
 * 1時間おきに実行されるメイン自動化関数。
 */
function sendVisitorAutomatedEmails() {
  // 1. Googleフォーム回答 (Listシート IMPORTRANGE) から新着をRDBテーブルへ全自動同期
  syncFormResponsesToRdb(); 

  const sheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL) || SheetUtil.getSheet(SHEET_NAMES.LIST);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 2. 各行をループ処理してステップメール送信判定
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const vf = RowParser.extractVisitorFields(row);
    if (!vf || !vf.email || !vf.email.includes("@")) continue;

    if (!vf.eventDateVal) continue;
    const eventDate = new Date(vf.eventDateVal);
    if (isNaN(eventDate.getTime())) continue;

    const diffDays = DateUtil.diffDays(eventDate, today);
    const attendanceCountNum = parseInt(vf.attendanceCount, 10) || 1;

    const statusObj = {
      visitorId: String(row[0]),
      isRepeater: attendanceCountNum > 1,
      isAttended: row[COL.IS_ATTENDED] === true || row[COL.IS_ATTENDED] === "参加",
      isJoined: row[COL.IS_JOINED] === true || row[COL.IS_JOINED] === "入会済",
      isGuest: String(row[COL.CATEGORY] || "").includes("ゲスト"),
      rowIndex: i + 1
    };

    processStepEmails(sheet, row, vf.email, diffDays, statusObj);
  }
}

/**
 * 配信タイミングとステータスに応じた送り分けロジック
 */
function processStepEmails(sheet, row, email, diffDays, statusObj) {
  const welcomeFlag = row[COL.FLG_ADD];

  if (welcomeFlag === "" || welcomeFlag === undefined) {
    if (diffDays < 0) {
      markAsSkipped(sheet, statusObj.rowIndex, COL.FLG_ADD + 1);
      return; 
    }

    // LINEグループへビジター新着速報を自動投稿
    sendLineAlert(row, statusObj.isRepeater, new Date(row[COL.EVENT_DATE])); 
    
    if (statusObj.isGuest) {
      executeSend(email, "EMAIL_GUEST_INTRO", row, statusObj.rowIndex, COL.FLG_ADD + 1, statusObj.visitorId);
    } else if (statusObj.isRepeater) {
      executeSend(email, "EMAIL_REPEATER_INTRO", row, statusObj.rowIndex, COL.FLG_ADD + 1, statusObj.visitorId);
    } else {
      executeSend(email, "EMAIL_VISITOR_INTRO", row, statusObj.rowIndex, COL.FLG_ADD + 1, statusObj.visitorId);
    }
    return; 
  }

  // 申込時メールが送信済み（"済"）でないビジター（スキップ "-" や未送信など）には、以降のステップメールを送信しない
  if (welcomeFlag !== "済") {
    return;
  }

  if (diffDays === 2) {
    executeSend(email, "EMAIL_REMIND_2DAYS", row, statusObj.rowIndex, COL.FLG_2DAYS + 1, statusObj.visitorId);
  } else if (diffDays === 1) {
    executeSend(email, "EMAIL_REMIND_1DAY", row, statusObj.rowIndex, COL.FLG_1DAY + 1, statusObj.visitorId);
  } else if (diffDays === 0) {
    if (statusObj.isAttended && !statusObj.isGuest) {
      executeSend(email, "EMAIL_THANKS_ATTENDED", row, statusObj.rowIndex, COL.FLG_THANKS + 1, statusObj.visitorId);
    } else if (!statusObj.isAttended) {
      executeSend(email, "EMAIL_THANKS_ABSENT", row, statusObj.rowIndex, COL.FLG_THANKS + 1, statusObj.visitorId);
    } else {
      markAsSkipped(sheet, statusObj.rowIndex, COL.FLG_THANKS + 1);
    }
  } else if (diffDays === -7) {
    if (statusObj.isAttended && !statusObj.isJoined && !statusObj.isGuest) {
      executeSend(email, "EMAIL_FOLLOW_7DAYS", row, statusObj.rowIndex, COL.FLG_7DAYS + 1, statusObj.visitorId);
    } else {
      markAsSkipped(sheet, statusObj.rowIndex, COL.FLG_7DAYS + 1);
    }
  } else if (diffDays === -30) {
    if (statusObj.isAttended && !statusObj.isJoined && !statusObj.isGuest) {
      executeSend(email, "EMAIL_FOLLOW_30DAYS", row, statusObj.rowIndex, COL.FLG_30DAYS + 1, statusObj.visitorId);
    } else {
      markAsSkipped(sheet, statusObj.rowIndex, COL.FLG_30DAYS + 1);
    }
  }
}

/**
 * 【一括設定】シートの10分おき定期チェック＆編集時リアルタイム同期トリガーを全自動登録
 */
function setupAutomatedTriggers() {
  const currentTriggers = ScriptApp.getProjectTriggers();
  currentTriggers.forEach(t => {
    const fnName = t.getHandlerFunction();
    if (["autoCheckAndSyncSheets", "sendVisitorAutomatedEmails", "onSpreadsheetEditTrigger", "onFormSubmitTrigger"].includes(fnName)) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 1. 10分おきのシート定期チェック ＆ 新着データ自動取り込みトリガー
  ScriptApp.newTrigger("autoCheckAndSyncSheets")
    .timeBased()
    .everyMinutes(10)
    .create();

  // 2. 1時間おきのステップメール自動送信エンジン
  ScriptApp.newTrigger("sendVisitorAutomatedEmails")
    .timeBased()
    .everyHours(1)
    .create();

  // 3. スプレッドシートの手動編集時リアルタイムキャッシュ更新トリガー
  const ss = SheetUtil.getSpreadsheet();
  if (ss) {
    ScriptApp.newTrigger("onSpreadsheetEditTrigger")
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    // 4. フォーム送信時リアルタイム同期トリガー
    ScriptApp.newTrigger("onFormSubmitTrigger")
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
  }

  Logger.log("✅ [自動同期トリガー設定完了] 10分おきのシート定期チェック・編集時リアルタイム同期トリガーが正常に有効化されました。");
  return "定期チェック＆高速データ管理用トリガーの登録が完了しました！";
}

/**
 * シートの手動編集時に即座に高速キャッシュを最新化するトリガーハンドラー
 */
function onSpreadsheetEditTrigger(e) {
  try {
    updateSummaryCacheTable();
  } catch (err) {
    Logger.log("Edit trigger error: " + err);
  }
}

/**
 * フォーム送信時に即座に新着データを同期＆キャッシュ更新するトリガーハンドラー
 */
function onFormSubmitTrigger(e) {
  try {
    autoCheckAndSyncSheets();
  } catch (err) {
    Logger.log("Form submit trigger error: " + err);
  }
}

/**
 * スプレッドシート開いた際にカスタムメニューを追加
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("⚡ ビジホスDX管理")
      .addItem("🔄 今すぐ同期＆高速キャッシュ更新", "autoCheckAndSyncSheets")
      .addItem("⚙️ 定期チェック自動トリガーの有効化", "setupAutomatedTriggers")
      .addToUi();
  } catch (e) {}
}