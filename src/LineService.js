/**
 * Visitor Host Revolution 2.0 - LINE通知 ＆ Webhookサービス
 */

/**
 * 定時LINE通知。シートで指定された曜日・時間に合致するものを送信。
 */
function sendLineNotification() {
  const target = getActiveLineTemplateForCurrentHour();
  if (!target) return;

  const message = replacePlaceholders(target.template, null);
  postToLineCustom(IS_TEST_MODE ? "【TEST送信】\n" + message : message, target.groupId || LINE_GROUP_ID);
}

/**
 * 新規申込が入った際のLINE速報
 */
function sendLineAlert(row, isRepeater, eventDate) {
  const lineTitle = isRepeater ? `🌟【再来申込】おかえりなさい！` : `✨【新規申込】はじめまして！`;
  const lineAction = isRepeater ? `がまた遊びに来てくれます！🔥` : `のお申し込みがありました！🚀`;
  const categoryText = String(row[COL.CATEGORY] || "").includes("ゲスト") ? "ゲスト" : "ビジター";
  const dateStr = DateUtil.format(eventDate, "MM/dd");
  
  const alertMsg = `${lineTitle}\n${row[COL.INVITER]}様より${categoryText}の${row[COL.VISITOR_NAME]}様${lineAction}\n━━━━━━━━\n💼 ${row[COL.PROFESSION]}\n📅 参加日: ${dateStr}`;
  
  postToLine(IS_TEST_MODE ? "【TEST速報】" + alertMsg : alertMsg);
}

/**
 * 「すぐ送る」チェックボックスがオンになった際の処理
 */
function handleQuickSend(sheet, range) {
  if (!sheet || sheet.getName() !== SHEET_NAMES.LINE_TEMPLATE || range.getColumn() !== 7 || range.getValue() !== true) return;
  
  const rowData = sheet.getRange(range.getRow(), 1, 1, 6).getValues()[0];
  const message = replacePlaceholders(rowData[5], null);
  
  postToLineCustom(IS_TEST_MODE ? "【すぐ送るTEST】\n" + message : message, rowData[4] || LINE_GROUP_ID);
  range.setValue(false); // ボタンを自動でオフに戻す
}

/**
 * カスタム宛先グループへLINEメッセージを送信
 */
function postToLineCustom(message, groupId) {
  const options = {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_TOKEN },
    payload: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] })
  };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
}

/**
 * デフォルトグループへLINEメッセージを送信
 */
function postToLine(message) { 
  postToLineCustom(message, LINE_GROUP_ID); 
}

/**
 * LINE Webhook (ID取得用)
 */
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) return;
  const event = JSON.parse(e.postData.contents).events[0];
  if (event && event.type === 'message' && event.message && event.message.text.includes("ID教えて")) {
    const groupId = (event.source && event.source.groupId) ? event.source.groupId : "個人チャット";
    const options = {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_TOKEN },
      payload: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: 'text', text: "ID: " + groupId }] })
    };
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
  }
}