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