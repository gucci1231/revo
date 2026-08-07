/**
 * Visitor Host Revolution 2.0 - メール配信サービス
 * テンプレート取得、プレースホルダー置換、Gmail送信、送信履歴DB記録、送信予定一覧抽出
 */

/**
 * テンプレートを読み込み、プレースホルダーを置換してGmailで送信。
 * 成功時にシートへ「済」を記入し、mail_historys DBにログを記録。
 */
function executeSend(email, templateKey, row, rowIndex, colIndex, visitorId) {
  const templates = getFollowMailTemplates();
  const t = templates[templateKey];
  
  if (!t) {
    console.warn(`Template not found: ${templateKey}`);
    return;
  }

  const subject = generateMailSubject(templateKey, row);
  const body = generateMailBody(templateKey, row);
  
  let targetEmail = email;
  if (IS_TEST_MODE) {
    targetEmail = TEST_EMAIL_LIST.join(',');
  }

  if (!targetEmail) {
    console.warn(`No recipient email address for template: ${templateKey}`);
    return;
  }

  try {
    const finalSubject = (IS_TEST_MODE ? "【TEST送信】" : "") + subject;
    GmailApp.sendEmail(targetEmail, finalSubject, body);
    
    // 本番モード且つ行指定がある場合のみTotalシートへ送信済みフラグを記入
    const totalSheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
    if (!IS_TEST_MODE && totalSheet && colIndex && rowIndex && rowIndex <= totalSheet.getLastRow()) {
      totalSheet.getRange(rowIndex, colIndex).setValue("済");
    }

    // mail_historys DBテーブルへ送信履歴を自動保存
    const vId = visitorId || (row ? String(row[0]) : "");
    recordMailHistoryInDb(vId, templateKey);

  } catch (e) {
    console.error(`Failed to send email (${templateKey}) to ${targetEmail}: ${e}`);
  }
}

/**
 * FollowMail_templateシートから全テンプレートを取得
 */
function getFollowMailTemplates() {
  const data = SheetUtil.getData(SHEET_NAMES.FOLLOW_MAIL_TEMPLATE);
  let templates = {};
  if (data.length > 1) {
    data.slice(1).forEach(r => {
      if (r[0]) {
        templates[r[0]] = { subject: r[1] || "", template: r[2] || "" };
      }
    });
  }
  return templates;
}

/**
 * メール件名の生成
 */
function generateMailSubject(templateKey, row) {
  const t = getFollowMailTemplates()[templateKey];
  if (!t) return "";
  return replacePlaceholders(t.subject, row);
}

/**
 * メール本文の生成
 */
function generateMailBody(templateKey, row) {
  const t = getFollowMailTemplates()[templateKey];
  if (!t) return "";
  let body = replacePlaceholders(t.template, row);
  if (row) {
    body = replacePersonalPlaceholders(body, row);
  }
  return body;
}

/**
 * 個別情報の置換（マッチング要望の動的差し込みを含む）
 */
function replacePersonalPlaceholders(text, row) {
  if (!text || !row) return text || "";
  let result = text;
  
  const vName = row[COL.VISITOR_NAME] || "";
  const vDate = DateUtil.format(row[COL.EVENT_DATE], "MM/dd");
  
  result = result.replace(/\{\$visitor_name\}/g, vName)
                 .replace(/\{\$name\}/g, vName)
                 .replace(/\{\$profession\}/g, row[COL.PROFESSION] || "")
                 .replace(/\{\$event_date\}/g, vDate);

  // マッチング要望の差し込み
  const reqContent = row[COL.MATCHING_REQ] || "";
  let matchingBlock = "";
  
  if (reqContent !== "") {
    matchingBlock = 
      "\n━━━━━━━━━━━━━━━━━━━━\n" +
      "🌟 マッチングのご要望について\n" +
      "「" + reqContent + "」に関するご要望、承知いたしました！\n" +
      "当日、最適なメンバーとお繋ぎできるよう現在調整を進めております。楽しみにしていてくださいね！\n" +
      "━━━━━━━━━━━━━━━━━━━━\n";
  }
  
  result = result.replace(/\{\$matching_status\}/g, matchingBlock);
  return result;
}

/**
 * mail_historys DBテーブルに送信ログを記録
 */
function recordMailHistoryInDb(visitorId, templateKey) {
  if (!visitorId) return;
  const mailSheet = SheetUtil.getSheet(SHEET_NAMES.MAIL_HISTORIES);
  if (!mailSheet) return;

  const mailTypeNames = {
    "EMAIL_VISITOR_INTRO": "新規ビジター参加案内 (Welcome)",
    "EMAIL_GUEST_INTRO": "他チャプターゲスト参加案内 (Welcome)",
    "EMAIL_REPEATER_INTRO": "再参加リピーター案内 (Welcome)",
    "EMAIL_REMIND_2DAYS": "定例会 2日前リマインド",
    "EMAIL_REMIND_1DAY": "定例会 前日リマインド",
    "EMAIL_THANKS_ATTENDED": "定例会ご参加御礼メール",
    "EMAIL_THANKS_ABSENT": "定例会欠席フォローメール",
    "EMAIL_FOLLOW_7DAYS": "参加1週間後フォローメール",
    "EMAIL_FOLLOW_30DAYS": "参加1ヶ月後フォローメール"
  };

  const mailTypeName = mailTypeNames[templateKey] || templateKey;
  mailSheet.appendRow([visitorId, mailTypeName, new Date(), "送信完了"]);
}

/**
 * 今後のメール送信予定一覧の算定・抽出 (送信予定一覧ページ用)
 */
function calculateScheduledEmailsList() {
  const sheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL) || SheetUtil.getSheet(SHEET_NAMES.LIST);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const data = sheet.getDataRange().getValues();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mailTypeLabels = {
    "EMAIL_VISITOR_INTRO": "新規ビジター参加案内 (Welcome)",
    "EMAIL_GUEST_INTRO": "他チャプターゲスト参加案内 (Welcome)",
    "EMAIL_REPEATER_INTRO": "再参加リピーター案内 (Welcome)",
    "EMAIL_REMIND_2DAYS": "定例会 2日前リマインド",
    "EMAIL_REMIND_1DAY": "定例会 前日リマインド",
    "EMAIL_THANKS_ATTENDED": "定例会御礼メール (出席)",
    "EMAIL_THANKS_ABSENT": "定例会欠席フォローメール",
    "EMAIL_FOLLOW_7DAYS": "参加1週間後フォローメール",
    "EMAIL_FOLLOW_30DAYS": "参加1ヶ月後フォローメール"
  };

  let scheduledList = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const vf = RowParser.extractVisitorFields(row);
    if (!vf || !vf.email || !vf.email.includes("@")) continue;
    if (!vf.eventDateVal) continue;

    const eventDate = new Date(vf.eventDateVal);
    if (isNaN(eventDate.getTime())) continue;
    eventDate.setHours(0, 0, 0, 0);

    const diffDays = DateUtil.diffDays(eventDate, today);
    const attendanceCountNum = parseInt(vf.attendanceCount, 10) || 1;
    const isRepeater = attendanceCountNum > 1;
    const isGuest = String(row[COL.CATEGORY] || "").includes("ゲスト");
    const isAttended = row[COL.IS_ATTENDED] === true || row[COL.IS_ATTENDED] === "参加";
    const isJoined = row[COL.IS_JOINED] === true || row[COL.IS_JOINED] === "入会済";
    const visitorId = String(row[0]);

    // 1. ウェルカムメール判定
    const welcomeFlag = row[COL.FLG_ADD];
    if (welcomeFlag === "" || welcomeFlag === undefined) {
      if (diffDays >= 0) {
        let templateKey = "EMAIL_VISITOR_INTRO";
        if (isGuest) templateKey = "EMAIL_GUEST_INTRO";
        else if (isRepeater) templateKey = "EMAIL_REPEATER_INTRO";

        const schedDate = vf.createdAt ? new Date(vf.createdAt) : today;
        const daysRem = DateUtil.diffDays(schedDate, today);

        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey, mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_ADD + 1,
          rowIndex: i + 1
        }));
      }
    }

    // 申込時メールが送信済み（"済"）でないビジター（スキップ "-" や未送信など）は、その後のステップメール送信予定リストに掲載しない
    if (welcomeFlag !== "済") {
      continue;
    }

    // 2. 2日前リマインド
    const flg2days = row[COL.FLG_2DAYS];
    if ((flg2days === "" || flg2days === undefined) && diffDays >= 0) {
      const schedDate = new Date(eventDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      const daysRem = DateUtil.diffDays(schedDate, today);
      if (daysRem >= -3) { // 3日前の過去までは表示範囲
        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey: "EMAIL_REMIND_2DAYS", mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_2DAYS + 1,
          rowIndex: i + 1
        }));
      }
    }

    // 3. 1日前リマインド
    const flg1day = row[COL.FLG_1DAY];
    if ((flg1day === "" || flg1day === undefined) && diffDays >= 0) {
      const schedDate = new Date(eventDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      const daysRem = DateUtil.diffDays(schedDate, today);
      if (daysRem >= -3) {
        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey: "EMAIL_REMIND_1DAY", mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_1DAY + 1,
          rowIndex: i + 1
        }));
      }
    }

    // 4. 当日御礼 / 欠席メール
    const flgThanks = row[COL.FLG_THANKS];
    if ((flgThanks === "" || flgThanks === undefined) && diffDays >= 0) {
      const schedDate = new Date(eventDate.getTime());
      const daysRem = DateUtil.diffDays(schedDate, today);
      const templateKey = (!row[COL.IS_ABSENT] && !isGuest) ? "EMAIL_THANKS_ATTENDED" : "EMAIL_THANKS_ABSENT";
      if (daysRem >= -3) {
        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey, mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_THANKS + 1,
          rowIndex: i + 1
        }));
      }
    }

    // 5. 7日後フォロー
    const flg7days = row[COL.FLG_7DAYS];
    if ((flg7days === "" || flg7days === undefined) && !isJoined && !isGuest) {
      const schedDate = new Date(eventDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const daysRem = DateUtil.diffDays(schedDate, today);
      if (daysRem >= -5) {
        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey: "EMAIL_FOLLOW_7DAYS", mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_7DAYS + 1,
          rowIndex: i + 1
        }));
      }
    }

    // 6. 30日後フォロー
    const flg30days = row[COL.FLG_30DAYS];
    if ((flg30days === "" || flg30days === undefined) && !isJoined && !isGuest) {
      const schedDate = new Date(eventDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRem = DateUtil.diffDays(schedDate, today);
      if (daysRem >= -5) {
        scheduledList.push(buildScheduledItem({
          visitorId, vf, row, templateKey: "EMAIL_FOLLOW_30DAYS", mailTypeLabels,
          scheduledDate: schedDate,
          daysRem,
          colIndex: COL.FLG_30DAYS + 1,
          rowIndex: i + 1
        }));
      }
    }
  }

  // 予定日の昇順（近い日順）にソート
  scheduledList.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  return scheduledList;
}

/**
 * 送信予定アイテムのオブジェクト構築
 */
function buildScheduledItem(params) {
  const { visitorId, vf, row, templateKey, mailTypeLabels, scheduledDate, daysRem, colIndex, rowIndex } = params;
  
  let statusStr = "送信予定";
  let statusBadgeClass = "badge-upcoming";
  
  if (daysRem === 0) {
    statusStr = "本日送信予定";
    statusBadgeClass = "badge-today";
  } else if (daysRem < 0) {
    statusStr = "即時/未処理";
    statusBadgeClass = "badge-urgent";
  } else {
    statusStr = `あと${daysRem}日`;
    statusBadgeClass = "badge-future";
  }

  const subject = generateMailSubject(templateKey, row);
  const body = generateMailBody(templateKey, row);

  return {
    visitorId: visitorId,
    visitorName: vf.name,
    email: vf.email,
    inviter: vf.inviter,
    company: vf.company,
    profession: vf.profession,
    eventDate: DateUtil.format(vf.eventDateVal, "yyyy/MM/dd"),
    templateKey: templateKey,
    mailTypeName: mailTypeLabels[templateKey] || templateKey,
    scheduledDate: DateUtil.format(scheduledDate, "yyyy/MM/dd"),
    daysRemaining: daysRem,
    status: statusStr,
    statusBadgeClass: statusBadgeClass,
    subject: subject,
    bodyPreview: body ? body.substring(0, 100) + "..." : "",
    bodyFull: body,
    colIndex: colIndex,
    rowIndex: rowIndex
  };
}