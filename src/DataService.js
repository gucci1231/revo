/**
 * Visitor Host Revolution 2.0 - シート同期 ＆ 操作用パネルサービス
 */

/**
 * ListシートからTotalシートへの新着自動転記
 */
function syncRawToTotal() {
  const ss = SheetUtil.getSpreadsheet();
  const rawSheet = ss.getSheetByName(SHEET_NAMES.LIST);
  const totalSheet = ss.getSheetByName(SHEET_NAMES.TOTAL);
  if (!rawSheet || !totalSheet) return;

  const totalData = totalSheet.getDataRange().getValues();
  
  // 重複チェック用のキーを作成
  const existingKeys = new Set();
  for (let j = 2; j < totalData.length; j++) {
    const email = totalData[j][COL.EMAIL];
    const date = totalData[j][COL.EVENT_DATE];
    if (email && date) {
      existingKeys.add(email + "_" + DateUtil.formatCompact(date));
    }
  }

  // 書き込むべき「次の行」を特定
  let lastRow = 1;
  const nameValues = totalSheet.getRange("H1:H").getValues();
  for (let r = nameValues.length - 1; r >= 0; r--) {
    if (nameValues[r][0] !== "") {
      lastRow = r + 1;
      break;
    }
  }

  const rawData = rawSheet.getDataRange().getValues();
  let addedCount = 0;

  rawData.slice(1).forEach(row => {
    const emailFromList = row[1];
    const dateFromList = row[12];
    if (!emailFromList) return;

    const key = emailFromList + "_" + DateUtil.formatCompact(dateFromList);

    if (!existingKeys.has(key)) {
      const targetRow = lastRow + addedCount + 1;
      let newRow = new Array(35).fill("");
      
      newRow[COL.NO]               = targetRow - 2;
      newRow[COL.APPLY_DATE]       = row[0];
      newRow[COL.EMAIL]            = row[1];
      newRow[COL.CATEGORY]         = row[2];
      newRow[COL.ATTENDANCE_COUNT] = row[3];
      newRow[COL.CHAPTER]          = row[4];
      newRow[COL.INVITER]          = row[5];
      newRow[COL.VISITOR_NAME]     = row[6];
      newRow[COL.FURIGANA]         = row[7];
      newRow[COL.PROFESSION]       = row[8];
      newRow[COL.COMPANY]          = row[9];
      newRow[COL.PHONE]            = row[10];
      newRow[COL.ZOOM_EXP]         = row[11];
      newRow[COL.EVENT_DATE]       = row[12];

      newRow[COL.IS_ATTENDED] = false;
      newRow[COL.IS_ABSENT] = false;
      newRow[COL.IS_JOINED] = false;

      totalSheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      totalSheet.getRange(targetRow, COL.IS_ATTENDED + 1, 1, 3).insertCheckboxes();
      
      addedCount++;
      existingKeys.add(key);
    }
  });

  if (addedCount > 0) {
    clearDashboardCache();
    refreshActionPanel();
  }
}

/**
 * 操作用パネルでの編集を、全データ保存庫（Total）に反映させる
 */
function syncPanelToMaster(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_NAMES.PANEL || range.getRow() < 3) return;

  const editRow = range.getRow();
  const editCol = range.getColumn();
  const val = range.getValue();

  const no = sheet.getRange(editRow, 1).getValue();
  const masterSheet = e.source.getSheetByName(SHEET_NAMES.TOTAL);
  if (!masterSheet) return;

  const masterData = masterSheet.getRange("A:A").getValues();
  
  let targetMasterRow = -1;
  for (let i = 0; i < masterData.length; i++) {
    if (masterData[i][0] == no) { targetMasterRow = i + 1; break; }
  }
  
  if (targetMasterRow === -1) return;

  let masterColIdx = -1;
  if (editCol === 6) masterColIdx = COL.IS_ATTENDED + 1;
  if (editCol === 7) masterColIdx = COL.IS_ABSENT + 1;
  if (editCol === 8) masterColIdx = COL.IS_JOINED + 1;
  if (editCol === 9) masterColIdx = COL.IS_1TO1 + 1;
  if (editCol === 10) masterColIdx = COL.HOT_LEVEL + 1;
  if (editCol === 11) masterColIdx = COL.NEXT_ACTION + 1;

  if (masterColIdx !== -1) {
    masterSheet.getRange(targetMasterRow, masterColIdx).setValue(val);
    
    if ((editCol === 6 || editCol === 7) && val === true) {
      processManualAttendance(masterSheet, masterSheet.getRange(targetMasterRow, masterColIdx));
    }
    
    e.source.toast("保存庫を更新しました。");
  }
}

function skipSteps(sheet, rowIdx, cols, mark) {
  if (!IS_TEST_MODE && sheet) {
    cols.forEach(c => sheet.getRange(rowIdx, c + 1).setValue(mark));
  }
}

function markAsSkipped(sheet, rowIdx, colNum) {
  if (!IS_TEST_MODE && sheet && rowIdx && colNum && rowIdx <= sheet.getLastRow()) {
    sheet.getRange(rowIdx, colNum).setValue("-");
  }
}

function formatDateStr(date) {
  return DateUtil.formatCompact(date);
}

/**
 * 管理用：Totalシートの重要列をロックする
 */
function protectSystemColumns() {
  const sheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
  if (!sheet) return;
  ["A:N", "S:X"].forEach(rangeStr => {
    const protection = sheet.getRange(rangeStr).protect().setDescription("システム管理エリア");
    protection.removeEditors(protection.getEditors());
    protection.addEditor(Session.getEffectiveUser());
  });
}

/**
 * 出欠チェックボックスが押された時の安全送信ロジック
 */
function processManualAttendance(sheet, range) {
  const rowIdx = range.getRow();
  const colIdx = range.getColumn();
  const isChecked = range.getValue();

  if (isChecked !== true) return;

  const rowData = sheet.getRange(rowIdx, 1, 1, sheet.getLastColumn()).getValues()[0];
  const email = rowData[COL.EMAIL];
  const eventDate = new Date(rowData[COL.EVENT_DATE]);
  const today = new Date();

  if (rowData[COL.FLG_THANKS] !== "") {
    SpreadsheetApp.getUi().alert("この方は既に当日メールを送信済みです。");
    return;
  }

  if (DateUtil.formatCompact(eventDate) > DateUtil.formatCompact(today)) {
    SpreadsheetApp.getUi().alert("まだ定例会当日ではありません。未来の日の送信はできません。");
    range.setValue(false);
    return;
  }

  if (colIdx === 16) {
    sheet.getRange(rowIdx, 17).setValue(false);
  } else {
    sheet.getRange(rowIdx, 16).setValue(false);
  }

  const isRepeater = (parseInt(rowData[COL.ATTENDANCE_COUNT], 10) || 1) > 1;
  let templateKey = "";

  if (colIdx === 16) {
    templateKey = isRepeater ? "EMAIL_THANK_YOU_REPEAT" : "EMAIL_THANK_YOU";
  } else {
    templateKey = "EMAIL_ABSENT";
  }

  const confirm = Browser.msgBox("確認", `このまま ${templateKey} を送信してもよろしいですか？`, Browser.Buttons.OK_CANCEL);
  if (confirm === "ok") {
    executeSend(email, templateKey, rowData, rowIdx, COL.FLG_THANKS + 1, String(rowData[0]));
    SpreadsheetApp.getActive().toast("メールを送信しました！");
  } else {
    range.setValue(false);
  }
}

/**
 * 操作用パネルを最新データで再描画
 */
function refreshActionPanel() {
  const masterSheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
  const panelSheet = SheetUtil.getSheet(SHEET_NAMES.PANEL);
  if (!masterSheet || !panelSheet) return;

  const masterData = masterSheet.getDataRange().getValues();
  let panelRows = [];

  for (let i = 1; i < masterData.length; i++) {
    const row = masterData[i];
    if (row[COL.IS_JOINED] !== true && row[COL.VISITOR_NAME] !== "") {
      panelRows.push([
        row[COL.NO],
        DateUtil.format(row[COL.EVENT_DATE], "MM/dd"),
        row[COL.VISITOR_NAME],
        row[COL.INVITER],
        row[COL.ATTENDANCE_COUNT],
        row[COL.IS_ATTENDED],
        row[COL.IS_ABSENT],
        row[COL.IS_JOINED],
        row[COL.IS_1TO1],
        row[COL.IS_MATCHED],
        row[COL.HOT_LEVEL],
        row[COL.MATCHING_REQ],
        row[COL.NEXT_ACTION],
        row[COL.HEARING_SHEET]
      ]);
    }
  }

  const lastRow = panelSheet.getLastRow();
  if (lastRow >= 3) panelSheet.getRange(3, 1, lastRow - 2, 14).clearContent().uncheck();
  
  if (panelRows.length > 0) {
    panelSheet.getRange(3, 1, panelRows.length, 14).setValues(panelRows);
    panelSheet.getRange(3, 6, panelRows.length, 5).insertCheckboxes();
  }
  SheetUtil.getSpreadsheet().toast("操作パネルを最新に更新しました。");
}