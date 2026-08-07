/**
 * Visitor Host Revolution 2.0 - レポート自動生成サービス
 */

/**
 * 【日曜正午実行】週次レポートを生成・送信・記録
 */
function sendWeeklySundayReport() {
  const sheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
  const reportLogSheet = SheetUtil.getSheet(SHEET_NAMES.REPORT_LOG);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRangeStr = `${DateUtil.format(lastWeek, "MM/dd")} 〜 ${DateUtil.format(now, "MM/dd")}`;
  
  let reportItems = [];
  let totalNew = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL.APPLY_DATE]) continue;
    const applyDate = new Date(row[COL.APPLY_DATE]);
    
    // 直近1週間の申込者を抽出
    if (applyDate >= lastWeek && applyDate <= now) {
      totalNew++;
      const name = row[COL.VISITOR_NAME];
      const inviter = row[COL.INVITER];
      
      // TotalシートのFeedback列 (Z〜AE) を直接スキャン
      let comments = [];
      for (let j = COL.FB_ADD; j <= COL.FB_30DAYS; j++) {
        if (row[j]) comments.push(row[j]);
      }
      
      const commentTxt = comments.length > 0 ? `💬: ${comments.join(' / ')}` : "（特記なし）";
      reportItems.push(`👤 ${name}様 (${inviter}様紹介)\n   ${commentTxt}`);
    }
  }

  let reportMsg = `📊 【週次ビジター活動報告】\n期間: ${dateRangeStr}\n━━━━━━━━━━━━━━\n`;
  reportMsg += `🔥 今週の新規申込：${totalNew}名\n\n`;
  
  if (reportItems.length > 0) {
    reportMsg += `📝 ビジター様からの反応・状況：\n\n` + reportItems.join("\n\n");
  } else {
    reportMsg += "今週の新規申込はありませんでした。";
  }
  reportMsg += `\n━━━━━━━━━━━━━━\n明朝の定例会に向けて、最終チェックをお願いします！🚀`;

  postToLine(IS_TEST_MODE ? "【TESTレポート】\n" + reportMsg : reportMsg);

  if (reportLogSheet) {
    reportLogSheet.appendRow([now, dateRangeStr, totalNew, reportMsg]);
  }
}