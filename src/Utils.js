/**
 * Visitor Host Revolution 2.0 - 共通ユーティリティ ＆ ヘルパーモジュール
 * (SheetUtil, DateUtil, RowParser, BNI期計算)
 */

/**
 * スプレッドシート操作の共通ユーティリティ
 */
const SheetUtil = {
  getSpreadsheet() {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (e) {}
    if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    return null;
  },

  getSheet(sheetName) {
    if (!sheetName) return null;
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) return sheet;

    // 日本語タブ名・同義語のフォールバック定義
    const aliases = {
      "visitors": ["visitors", "ビジター", "ビジター一覧", "ビジター情報"],
      "visitors_status": ["visitors_status", "ビジターバッチ", "ステータス", "状況"],
      "hearing_sheets": ["hearing_sheets", "ヒアリングシート", "ヒアリングシート（回答）", "ヒアリングシートの回答", "ヒアリング", "オリエンシート", "visitor_orientation_sheets"],
      "List": ["List", "リスト", "フォームの回答 1", "フォームの回答 2", "フォームの回答", "新着申込"],
      "members": ["members", "メンバー", "メンバーマスタ", "メンバー一覧"],
      "settings": ["settings", "setting", "Setting", "設定"]
    };

    const altList = aliases[sheetName] || [];
    for (let i = 0; i < altList.length; i++) {
      sheet = ss.getSheetByName(altList[i]);
      if (sheet) return sheet;
    }

    // あいまい検索 (大文字小文字・スペース・アンダースコア無視)
    const sheets = ss.getSheets();
    const cleanTarget = String(sheetName).toLowerCase().replace(/[\s_]/g, '');
    for (let i = 0; i < sheets.length; i++) {
      const sName = sheets[i].getName().toLowerCase().replace(/[\s_]/g, '');
      if (sName === cleanTarget) return sheets[i];
    }

    return null;
  },

  getData(sheetName) {
    const sheet = this.getSheet(sheetName);
    if (!sheet || sheet.getLastRow() <= 0) return [];
    return sheet.getDataRange().getValues();
  }
};

/**
 * 日付処理の共通ユーティリティ
 */
const DateUtil = {
  /**
   * 日付をJSTタイムゾーンでフォーマット
   */
  format(date, formatPattern = "yyyy/MM/dd") {
    if (!date) return "";
    const d = (date instanceof Date) ? date : this.parse(date);
    if (!(d instanceof Date) || isNaN(d.getTime())) return String(date);
    return Utilities.formatDate(d, "JST", formatPattern);
  },

  /**
   * 日付をyyyymmdd文字列へフォーマット (重複キー生成用)
   */
  formatCompact(date) {
    if (!date) return "";
    const d = (date instanceof Date) ? date : this.parse(date);
    if (d instanceof Date && !isNaN(d.getTime())) return Utilities.formatDate(d, "JST", "yyyyMMdd");
    return String(date).trim();
  },

  /**
   * 日付文字列またはDateオブジェクトをパース (日本語日付 '2026年8月7日' や '8/7' 等に完全対応)
   */
  parse(val) {
    if (!val && val !== 0) return "";
    if (val instanceof Date) return val;
    let str = String(val).trim();
    if (!str) return "";

    // 日本語表記 '2026年8月7日' や '2026.8.7', '2026-8-7' を標準スラッシュ区切り '2026/8/7' へ変換
    str = str.replace(/年|月/g, '/').replace(/日/g, '').replace(/\./g, '/').replace(/-/g, '/');

    const parts = str.split('/').map(p => p.trim()).filter(p => p !== "");
    if (parts.length === 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        // 2桁年 (26 -> 2026, 01 -> 2026) や JSの"07/30"誤解析 (2001年) の補正
        const nowYear = new Date().getFullYear();
        if (y < 100) {
          y = (y === 1) ? nowYear : 2000 + y;
        } else if (y === 2001 && parts[0] === "01") {
          y = nowYear;
        }
        return new Date(y, m - 1, d);
      }
    } else if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(d)) {
        const now = new Date();
        let year = now.getFullYear();
        if (m < 4 && now.getMonth() >= 9) year += 1;
        return new Date(year, m - 1, d);
      }
    }

    const nativeD = new Date(str);
    if (!isNaN(nativeD.getTime())) {
      if (nativeD.getFullYear() === 2001 && str.startsWith("01/")) {
        nativeD.setFullYear(new Date().getFullYear());
      }
      return nativeD;
    }

    return val;
  },

  /**
   * 直近の次回木曜日を取得
   */
  getNextThursday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    let diff = (3 + 7 - d.getDay()) % 7; // 水曜 = 3
    if (diff === 0) diff = 7; // 今日が水曜でも「次の水曜」は来週
    d.setDate(d.getDate() + diff);
    return d;
  },

  /**
   * 2つの日付の日数差（target - base）を計算
   */
  diffDays(targetDate, baseDate = new Date()) {
    const t = new Date(targetDate);
    const b = new Date(baseDate);
    t.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    return Math.floor((t.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  }
};

/**
 * フォーム回答/シート行からのビジター情報抽出ヘルパー (DRY化)
 */
const RowParser = {
  extractVisitorFields(row, defaultNow = new Date()) {
    if (!row || !Array.isArray(row)) return null;

    let name = "";
    let email = "";
    let inviter = "";
    let furigana = "";
    let profession = "";
    let company = "";
    let attendanceCount = "";
    let eventDateVal = "";
    let createdAt = defaultNow;

    if (row.length >= 13 && (row[RAW_FORM_COL.VISITOR_NAME] || row[RAW_FORM_COL.EMAIL])) {
      name = String(row[RAW_FORM_COL.VISITOR_NAME] || "").trim();
      email = String(row[RAW_FORM_COL.EMAIL] || "").trim();
      inviter = String(row[RAW_FORM_COL.INVITER] || "").trim();
      furigana = String(row[RAW_FORM_COL.FURIGANA] || "").trim();
      profession = String(row[RAW_FORM_COL.PROFESSION] || "").trim();
      company = String(row[RAW_FORM_COL.COMPANY] || "").trim();
      attendanceCount = String(row[RAW_FORM_COL.ATTENDANCE_COUNT] || "初めて").trim();
      eventDateVal = row[RAW_FORM_COL.EVENT_DATE];
      if (row[RAW_FORM_COL.TIMESTAMP]) createdAt = new Date(row[RAW_FORM_COL.TIMESTAMP]);
    } else {
      name = String(row[COL.VISITOR_NAME] || "").trim();
      email = String(row[COL.EMAIL] || "").trim();
      inviter = String(row[COL.INVITER] || "").trim();
      furigana = String(row[COL.FURIGANA] || "").trim();
      profession = String(row[COL.PROFESSION] || "").trim();
      company = String(row[COL.COMPANY] || "").trim();
      attendanceCount = String(row[COL.ATTENDANCE_COUNT] || "初めて").trim();
      eventDateVal = row[COL.EVENT_DATE];
      if (row[COL.APPLY_DATE]) createdAt = new Date(row[COL.APPLY_DATE]);
    }

    return {
      name,
      email,
      inviter,
      furigana,
      profession,
      company,
      attendanceCount,
      eventDateVal,
      createdAt
    };
  }
};

/**
 * BNIの期（半期：4月〜/10月〜）を過去から未来まで自動計算生成する関数
 */
function generateBniTermsList() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let currentTermYear = currentYear;
  let currentTermStartMonth = 4;
  if (currentMonth < 4) {
    currentTermYear = currentYear - 1;
    currentTermStartMonth = 10;
  } else if (currentMonth >= 10) {
    currentTermYear = currentYear;
    currentTermStartMonth = 10;
  } else {
    currentTermYear = currentYear;
    currentTermStartMonth = 4;
  }

  const baseYear = 2025;
  const baseMonth = 4;
  let terms = [];

  let loopYear = currentTermYear;
  let loopMonth = currentTermStartMonth;

  while (true) {
    if (loopYear < baseYear || (loopYear === baseYear && loopMonth < baseMonth)) {
      break;
    }

    const diffMonths = (loopYear - baseYear) * 12 + (loopMonth - baseMonth);
    const halfIndex = Math.floor(diffMonths / 6);
    const termNo = Math.floor(halfIndex / 2) + 1;
    const halfStr = halfIndex % 2 === 0 ? "上半期" : "下半期";

    const monthStr = loopMonth < 10 ? "0" + loopMonth : String(loopMonth);
    const dateStr = `${loopYear}/${monthStr}/01`;
    const isCurrent = (loopYear === currentTermYear && loopMonth === currentTermStartMonth);

    terms.push({
      dateStr: dateStr,
      label: `${dateStr} 〜 (第${termNo}期 ${halfStr})${isCurrent ? ' [現在の期]' : ''}`,
      isCurrent: isCurrent
    });

    loopMonth -= 6;
    if (loopMonth <= 0) {
      loopYear -= 1;
      loopMonth += 12;
    }
  }

  terms.push({
    dateStr: "2025/01/01",
    label: "全期間表示 (2025年〜)",
    isCurrent: false
  });

  return terms;
}

/**
 * 対象日のビジター名簿テキスト一覧の生成
 */
function generateVisitorListText(targetDate) {
  try {
    const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
    if (!visitorsSheet || visitorsSheet.getLastRow() <= 1) return "なし";

    const vData = visitorsSheet.getDataRange().getValues();
    const targetStr = DateUtil.format(targetDate, "yyyy/MM/dd");
    let names = [];

    for (let i = 1; i < vData.length; i++) {
      const row = vData[i];
      if (!row[4]) continue;
      const vDateStr = DateUtil.format(row[3], "yyyy/MM/dd");
      if (vDateStr === targetStr) {
        const name = String(row[4]).trim();
        const company = String(row[7] || "").trim();
        names.push(company ? `${name}様 (${company})` : `${name}様`);
      }
    }
    return names.length > 0 ? names.join("、") : "なし";
  } catch (e) {
    return "なし";
  }
}

/**
 * メインプレゼンター情報を取得する（未登録時はデフォルト値）
 */
function getMainPresentationInfo(targetDate) {
  try {
    const sheet = SheetUtil.getSheet("メインプレゼンター") || SheetUtil.getSheet("メインプレゼン");
    if (sheet && sheet.getLastRow() > 1) {
      const data = sheet.getDataRange().getValues();
      const targetStr = DateUtil.format(targetDate, "yyyy/MM/dd");
      for (let i = 1; i < data.length; i++) {
        const rowDate = DateUtil.format(data[i][0], "yyyy/MM/dd");
        if (rowDate === targetStr) {
          return {
            presenter: String(data[i][1] || "未定").trim(),
            wanted: String(data[i][2] || "なし").trim()
          };
        }
      }
    }
  } catch (e) {}
  return { presenter: "未定", wanted: "なし" };
}

/**
 * テンプレート内の変数をすべて置換
 */
function replacePlaceholders(text, visitorRow) {
  if (!text) return "";
  const nextThu = DateUtil.getNextThursday();
  
  const pInfo = getMainPresentationInfo(nextThu);
  const vList = generateVisitorListText(nextThu);
  const ras = getRandomTemplateMessage(text, "{$ras_message}", SHEET_NAMES.RAS_TEMPLATE);
  const ref = getRandomTemplateMessage(text, "{$referral_message}", SHEET_NAMES.REFERRAL_TEMPLATE);

  let res = text
    .replace(/\{\$date\}/g, DateUtil.format(nextThu, "MM/dd"))
    .replace(/\{\$visitor\}/g, vList)
    .replace(/\{\$main_presenter\}/g, pInfo.presenter)
    .replace(/\{\$wanted\}/g, pInfo.wanted)
    .replace(/\{\$ras_message\}/g, ras)
    .replace(/\{\$referral_message\}/g, ref);

  if (visitorRow) {
    const vName = visitorRow[COL.VISITOR_NAME] || "";
    const vDate = DateUtil.format(visitorRow[COL.EVENT_DATE], "MM/dd");
    res = res.replace(/\{\$visitor_name\}/g, vName).replace(/\{\$name\}/g, vName)
             .replace(/\{\$profession\}/g, visitorRow[COL.PROFESSION] || "")
             .replace(/\{\$event_date\}/g, vDate);
  }
  return res;
}

/**
 * LINE用：現在時刻と曜日に合うActiveな1行をランダムに取得
 */
function getActiveLineTemplateForCurrentHour() {
  const data = SheetUtil.getData(SHEET_NAMES.LINE_TEMPLATE);
  if (data.length <= 1) return null;

  const now = new Date();
  const todayLabel = ["日","月","火","水","木","金","土"][now.getDay()];
  const isWantedEmpty = getMainPresentationInfo(DateUtil.getNextThursday()).wanted === "なし";

  const activeRows = data.filter((row, i) => {
    if (i === 0 || row[0] !== true) return false;
    const hours = String(row[3]).split(',').map(h => parseInt(h.trim(), 10));
    const hourMatch = hours.includes(now.getHours());
    const timingMatch = String(row[2]).includes(todayLabel);
    const wantedSafety = !(isWantedEmpty && String(row[5]).includes("{$wanted}"));
    return hourMatch && timingMatch && wantedSafety;
  });

  if (activeRows.length === 0) return null;
  const sel = activeRows[Math.floor(Math.random() * activeRows.length)];
  return { groupId: sel[4], template: sel[5] };
}

function getRandomTemplateMessage(text, tag, sheetName) {
  if (!text.includes(tag)) return "";
  const data = SheetUtil.getData(sheetName);
  const active = data.filter((r, i) => i > 0 && r[0] === true);
  return active.length > 0 ? active[Math.floor(Math.random() * active.length)][2] : "";
}

/**
 * ABCランク評価文字列の正規化（"🔥 評価 A", "評価 A", "A評価", "Aランク" などを 'A', 'B', 'C' に安全変換）
 */
function parseFeelAbc(val) {
  if (!val) return '';
  const s = String(val).toUpperCase().trim();
  if (s === 'A' || s === 'B' || s === 'C') return s;
  if (s.includes('A')) return 'A';
  if (s.includes('B')) return 'B';
  if (s.includes('C')) return 'C';
  return '';
}

/**
 * GAS HTMLService用 include ヘルパー関数 (Scriptlet評価対応)
 */
function include(filename) {
  try {
    return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
  } catch (e) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }
}