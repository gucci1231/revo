/**
 * Visitor Host Revolution 2.0 - デバッグ ＆ テスト実行用モジュール
 */

/**
 * 全メールパターンの表示・送信確認
 */
function debug_sendAllTestPatterns() {
  const totalSheet = SheetUtil.getSheet(SHEET_NAMES.TOTAL);
  if (!totalSheet || totalSheet.getLastRow() < 2) {
    console.warn("Total sheet has no sample row to test.");
    return;
  }
  const testData = totalSheet.getRange(2, 1, 1, 30).getValues()[0];
  const patterns = [
    "EMAIL_INTRO", "EMAIL_URGENT", "EMAIL_2DAYS_AGO", "EMAIL_PREV_DAY", 
    "EMAIL_THANK_YOU", "EMAIL_THANK_YOU_REPEAT", "EMAIL_ABSENT", 
    "EMAIL_AFTER_FOLLOW_7", "EMAIL_AFTER_FOLLOW_30", 
    "EMAIL_ABSENT_FOLLOW_7", "EMAIL_ABSENT_FOLLOW_30"
  ];
  
  console.log("--- メール送信テスト開始 ---");
  patterns.forEach(key => { 
    executeSend("dummy@example.com", key, testData, null, null, String(testData[0])); 
    Utilities.sleep(1500); 
  });
}

/**
 * 全ActiveなLINEテンプレートの表示・送信確認
 */
function debug_sendAllLineTemplates() {
  const data = SheetUtil.getData(SHEET_NAMES.LINE_TEMPLATE);
  if (data.length <= 1) {
    console.warn("No LINE templates found.");
    return;
  }
  console.log("--- LINE送信テスト開始 ---");
  data.forEach((row, i) => {
    if (i === 0 || row[0] !== true) return;
    const message = replacePlaceholders(row[5], null);
    postToLineCustom("【LINEテスト:" + row[1] + "】\n" + message, row[4] || LINE_GROUP_ID);
    Utilities.sleep(1000);
  });
}

/**
 * 【デバッグ用】ヒアリングシート保存 ＆ キャッシュ更新の直接検証テスト
 */
function debug_testHearingFormSave() {
  console.log("=== ヒアリングシート保存デバッグテスト開始 ===");
  const visitorsSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
  if (!visitorsSheet || visitorsSheet.getLastRow() < 2) {
    console.error("❌ visitors シートにデータがありません");
    return;
  }
  const sampleVisitorId = String(visitorsSheet.getRange("A2").getValue()).trim();
  console.log("対象ビジターID:", sampleVisitorId);

  const testForm = {
    visitorId: sampleVisitorId,
    orientUser: "テストオリエン担当",
    q1: "Q1デバッグ感想テスト",
    q2: "Q2デバッグ仕事内容",
    q3: "Q3デバッグ目標",
    q4: "Q4デバッグ課題",
    q5: "Q5デバッグ選択肢",
    q6: "Q6デバッグ今後",
    q7: "Q7デバッグ促し内容（改行あり\nテスト2行目）",
    feelAbc: "A",
    orientMemo: "オリエン直後メモテスト",
    followMemo: "フォローメモテスト"
  };

  try {
    console.log("1. saveHearingFormApi 実行...");
    const res = saveHearingFormApi(testForm);
    console.log("saveHearingFormApi 結果:", JSON.stringify(res));

    console.log("2. updateSummaryCacheTable 実行...");
    const summaryData = updateSummaryCacheTable();
    console.log("updateSummaryCacheTable 成功！ 生成されたHOTビジター件数:", summaryData.tables ? summaryData.tables.hotVisitors.length : 0);

    console.log("3. getDashboardData 実行...");
    const dashResult = getDashboardData();
    console.log("getDashboardData 成功！");

    console.log("=== 全テスト正常完了 ===");
  } catch (err) {
    console.error("❌ エラー発生:", err.message, err.stack);
  }
}

/**
 * 【システム全自動包括診断】Apps Scriptで実行してシステム全体のエラー・ボトルネックを特定
 */
function debug_runFullSystemDiagnostics() {
  console.log("🔍 ===========================================");
  console.log("🔍 VISITOR HOST REVOLUTION 包括診断テスト開始");
  console.log("🔍 ===========================================");

  let errorCount = 0;

  // 1. スプレッドシート ＆ 全主要シートの存在と件数検証
  console.log("\n--- [診断 1] シート構造およびデータ存在検証 ---");
  try {
    const requiredSheets = [
      SHEET_NAMES.VISITORS,
      SHEET_NAMES.VISITORS_STATUS,
      SHEET_NAMES.HEARING_SHEETS,
      SHEET_NAMES.MEMBERS,
      SHEET_NAMES.SETTINGS,
      SHEET_NAMES.SUMMARY_CACHE
    ];

    requiredSheets.forEach(sName => {
      const sh = SheetUtil.getSheet(sName);
      if (!sh) {
        console.error(`❌ シートが見つかりません: ${sName}`);
        errorCount++;
      } else {
        const rows = sh.getLastRow();
        console.log(`✅ シート正常: [${sName}] (総行数: ${rows})`);
      }
    });
  } catch (e) {
    console.error("❌ シート検証中に例外発生:", e.message, e.stack);
    errorCount++;
  }

  // 2. doGet エントリポイントおよび HTML テンプレート評価の検証
  console.log("\n--- [診断 2] doGet および Web App HTML テンプレート検証 ---");
  try {
    const res = doGet({});
    if (res && typeof res.getContent === 'function') {
      const htmlContent = res.getContent();
      console.log(`✅ doGet レンダリング成功！ (生成HTMLサイズ: ${htmlContent.length} bytes)`);
    } else {
      console.log(`✅ doGet 評価オブジェクト取得完了`);
    }
  } catch (e) {
    console.error("❌ doGet 評価時にエラー発生:", e.message, e.stack);
    errorCount++;
  }

  // 3. Web UI 初期データ取得 API (getFastInitialData) 検証
  console.log("\n--- [診断 3] getFastInitialData 実行検証 ---");
  try {
    const initData = getFastInitialData();
    console.log("✅ getFastInitialData 取得完了");
    if (!initData.dashboardData) {
      console.warn("⚠️ dashboardData が空です");
    } else {
      console.log("   - applyCount:", initData.dashboardData.metrics ? initData.dashboardData.metrics.applyCount : 'N/A');
      console.log("   - HOTビジター数:", initData.dashboardData.tables ? initData.dashboardData.tables.hotVisitors.length : 'N/A');
    }
  } catch (e) {
    console.error("❌ getFastInitialData 実行中にエラー:", e.message, e.stack);
    errorCount++;
  }

  // 4. ダッシュボード更新・キャッシュ集計 (updateSummaryCacheTable) 検証
  console.log("\n--- [診断 4] updateSummaryCacheTable ＆ キャッシュサイズ検証 ---");
  try {
    const dashObj = updateSummaryCacheTable();
    const jsonStr = JSON.stringify(dashObj);
    console.log(`✅ updateSummaryCacheTable 成功！ (JSON文字数: ${jsonStr.length} 文字)`);
    if (jsonStr.length > 49000) {
      console.warn(`⚠️ 注意: セル上限(50000文字)に近いです (${jsonStr.length}文字)`);
    }
  } catch (e) {
    console.error("❌ updateSummaryCacheTable 実行中にエラー:", e.message, e.stack);
    errorCount++;
  }

  // 5. ヒアリングフォーム情報取得 (getHearingFormDataApi) 検証
  console.log("\n--- [診断 5] getHearingFormDataApi 検証 ---");
  try {
    const vSheet = SheetUtil.getSheet(SHEET_NAMES.VISITORS);
    if (vSheet && vSheet.getLastRow() > 1) {
      const targetId = String(vSheet.getRange("A2").getValue()).trim();
      const hData = getHearingFormDataApi(targetId);
      console.log(`✅ ID: ${targetId} のヒアリングフォームデータ取得成功 (visitor_name: ${hData.visitorInfo ? hData.visitorInfo.visitor_name : ''})`);
    }
  } catch (e) {
    console.error("❌ getHearingFormDataApi 実行中にエラー:", e.message, e.stack);
    errorCount++;
  }

  console.log("\n===========================================");
  if (errorCount === 0) {
    console.log("🎉 【診断結果】バックエンドAPIおよびデータ処理にエラーはありません！");
  } else {
    console.error(`⚠️ 【診断結果】合計 ${errorCount} 件のエラーが検出されました。上記の赤文字エラーをご確認ください。`);
  }
  console.log("===========================================\n");
}

/**
 * 【デバッグ用】visitors シートと hearing_sheets シートのID紐付け状態を全件チェック
 */
function debug_checkHearingAndVisitorData() {
  console.log("=== ヒアリングシート一覧 ＆ ビジター紐付け詳細検証 ===");
  const res = getHearingSheetsListApi();
  console.log("getHearingSheetsListApi 取得件数:", res.list ? res.list.length : 0);
  if (res.list && res.list.length > 0) {
    res.list.forEach((item, idx) => {
      console.log(`[${idx + 1}] ID: ${item.visitorId} | 氏名: '${item.name}' | 会社: '${item.company}' | 日付: '${item.eventDate}' | オリエン担当: '${item.orientUser}' | Q1: '${item.q1}' | ABC: '${item.feelAbc}'`);
    });
  }
}