const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('PALMS Ranking Feature Tests (Step 2-2)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies PALMS Ranking navigation item is active and updated in drawer', () => {
    assert.strictEqual(indexHtml.includes('id="drawer-item-palms-ranking"'), true);
    // Should NOT be marked as (開発中) in PAGE_NAV_INFO
    assert.strictEqual(indexHtml.includes("'palms-ranking': { title: 'PALMSランキング'"), true);
  });

  it('verifies PALMS Ranking HTML container and UI elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('<div id="view-palms-ranking" class="view-content">'), true);
    assert.strictEqual(indexHtml.includes('id="view-palms-ranking" class="view-content" style="display: none;"'), false);
    assert.strictEqual(indexHtml.includes('id="palms-period-select"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-sync-palms"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-metric-tabs"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-podium-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-table-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-table-body"'), true);
  });

  it('verifies PALMS Ranking JS functions are defined in scripts', () => {
    assert.strictEqual(indexHtml.includes('function fetchPalmsRankingData'), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsPeriods'), true);
    assert.strictEqual(indexHtml.includes('function syncPalmsFromBniConnect'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsRankingView'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsPodium'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsTable'), true);
    assert.strictEqual(indexHtml.includes('function switchPalmsMetric'), true);
    assert.strictEqual(indexHtml.includes('function sortPalmsTable'), true);
    assert.strictEqual(indexHtml.includes('function calcBniTrafficLightScore'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsCharts'), true);
  });

  it('verifies ApiService mappings exist for PALMS endpoints', () => {
    assert.strictEqual(indexHtml.includes('getPalmsListApi'), true);
    assert.strictEqual(indexHtml.includes('getPalmsPeriodsApi'), true);
    assert.strictEqual(indexHtml.includes('syncPalmsApi'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=list'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=periods'), true);
    assert.strictEqual(indexHtml.includes('/api/palms.php?action=sync'), true);
  });

  it('verifies Router handles palms-ranking tab properly without dev alert', () => {
    // Should NOT be blocked in switchTab
    const switchTabMatch = indexHtml.match(/function switchTab\([^)]*\)\s*\{([^}]+)\}/);
    assert.ok(switchTabMatch, 'switchTab should exist');
    // Ensure palms-ranking is not in the blocking check
    assert.strictEqual(
      indexHtml.includes("['palms-ranking', 'training', 'schedules'].includes(tabName)"),
      false
    );
  });

  it('verifies BNI Traffic Lights official 100-point scoring system and color tiers according to CSV', () => {
    // Extract calcBniTrafficLightScore from indexHtml or evaluate
    const calcFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(calcFnMatch, 'calcBniTrafficLightScore function must exist in indexHtml');

    const calcBniTrafficLightScore = new Function('r', 'weeks', calcFnMatch[1]);

    // 1. High Performer: All top tiers -> 100 pt (GREEN)
    // 26 weeks (6 months)
    // vis: 5 (25pt), tyfcb: 6,000,000 (5pt), oto: 26 (1/wk = 20pt), ref: 33 (1.26/wk = 25pt), sponsors: 1 (5pt), ceu: 14 (0.53/wk = 10pt), att: 25/25 (100% = 10pt)
    const memberGreen = {
      visitors: 5,
      tyfcb_yen: 6000000,
      one_to_ones: 26,
      total_referrals_given: 33,
      sponsors: 1,
      testimonials: 1,
      ceu: 14,
      p: 25, a: 0, l: 0, m: 0, s: 0
    };
    const resGreen = calcBniTrafficLightScore(memberGreen, 26);
    assert.strictEqual(resGreen.totalScore, 100);
    assert.strictEqual(resGreen.tier, 'green');

    // 2. Medium Performer (YELLOW): 50-69 pt
    // vis: 2 (10pt), tyfcb: 400,000 (2pt), oto: 13 (0.5/wk = 10pt), ref: 20 (0.76/wk = 15pt), sponsors: 0 (0pt), ceu: 8 (0.3/wk = 5pt), att: 23/25 (92% = 5pt)
    // total = 10 + 2 + 10 + 15 + 0 + 5 + 5 = 47 (Wait, let's bump ref to 1.0/wk = 20pt -> 52pt)
    const memberYellow = {
      visitors: 2,
      tyfcb_yen: 400000,
      one_to_ones: 13,
      total_referrals_given: 26, // 1.0/wk -> 20pt
      sponsors: 0,
      testimonials: 0,
      ceu: 8, // 5pt
      p: 23, a: 2, l: 0, m: 0, s: 0 // 92% -> 5pt
    };
    // 10 + 2 + 10 + 20 + 0 + 5 + 5 = 52
    const resYellow = calcBniTrafficLightScore(memberYellow, 26);
    assert.strictEqual(resYellow.totalScore, 52);
    assert.strictEqual(resYellow.tier, 'yellow');

    // 3. Low Performer (RED / GREY): < 50 pt
    const memberRed = {
      visitors: 1, // 5pt
      tyfcb_yen: 0, // 0pt
      one_to_ones: 7, // 0.26/wk -> 5pt
      total_referrals_given: 13, // 0.5/wk -> 10pt
      sponsors: 0,
      testimonials: 0, // 0pt
      ceu: 0, // 0pt
      p: 20, a: 5, l: 0, m: 0, s: 0 // 80% -> 0pt
    };
    // 5 + 0 + 5 + 10 + 0 + 0 + 0 = 20 (GREY)
    const resRed = calcBniTrafficLightScore(memberRed, 26);
    assert.strictEqual(resRed.totalScore, 20);
    assert.strictEqual(resRed.tier, 'grey');
  });

  it('verifies PPW and RPW calculation and 3 benchmark bands according to BNI guidelines', () => {
    const calcFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(calcFnMatch, 'calcBniTrafficLightScore function must exist in indexHtml');

    const calcBniTrafficLightScore = new Function('r', 'weeks', calcFnMatch[1]);

    // Test Case 1: 4 weeks, High PPW performer (>= 2.0000)
    // rgi=6, rgo=2, vis=2, testimonials=1, p=4, a=0, l=0, m=0, s=0
    // W = 4
    // RPW = (6 + 2) / 4 = 2.0000
    // PPW = (6 + 2 + 2 + 1) / 4 = 11 / 4 = 2.7500
    const m1 = {
      rgi: 6,
      rgo: 2,
      total_referrals_given: 8,
      visitors: 2,
      testimonials: 1,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res1 = calcBniTrafficLightScore(m1, 4);
    assert.strictEqual(res1.rpw, 2.0);
    assert.strictEqual(res1.ppw, 2.75);
    assert.strictEqual(res1.ppwTier, 'high'); // >= 2.0

    // Test Case 2: 4 weeks, Mid PPW performer (1.0000 <= PPW < 2.0000)
    // rgi=2, rgo=1, vis=1, testimonials=1, p=4
    // RPW = 3 / 4 = 0.7500
    // PPW = (3 + 1 + 1) / 4 = 5 / 4 = 1.2500
    const m2 = {
      rgi: 2,
      rgo: 1,
      total_referrals_given: 3,
      visitors: 1,
      testimonials: 1,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res2 = calcBniTrafficLightScore(m2, 4);
    assert.strictEqual(res2.rpw, 0.75);
    assert.strictEqual(res2.ppw, 1.25);
    assert.strictEqual(res2.ppwTier, 'mid'); // 1.0 - 2.0

    // Test Case 3: 4 weeks, Low PPW performer (< 1.0000)
    // rgi=1, rgo=0, vis=0, testimonials=0, p=4
    // RPW = 1 / 4 = 0.2500
    // PPW = 1 / 4 = 0.2500
    const m3 = {
      rgi: 1,
      rgo: 0,
      total_referrals_given: 1,
      visitors: 0,
      testimonials: 0,
      p: 4, a: 0, l: 0, m: 0, s: 0
    };
    const res3 = calcBniTrafficLightScore(m3, 4);
    assert.strictEqual(res3.rpw, 0.25);
    assert.strictEqual(res3.ppw, 0.25);
    assert.strictEqual(res3.ppwTier, 'low'); // < 1.0

    // Test Case 4: 新しい会員（期間が26週であっても、出席が始まった週＝P+A+L+M+S からカウントして算出）
    // 期間週数=26週だが、期中入会で6週出席 (p=5, a=1, l=0, m=0, s=0 -> 6週)
    // 期間の週数(26週)で割るのではなく、出席が始まった週からのカウント(6週)で算出
    // RPW = 12 / 6 = 2.0000
    // PPW = (12 + 3) / 6 = 2.5000
    const newMember = {
      p_present: 5,
      a_absent: 1,
      l_late: 0,
      m_medical: 0,
      s_substitute: 0,
      rgi_referrals_given_internal: 8,
      rgo_referrals_given_external: 4,
      total_referrals_given: 12,
      v_visitors: 3,
      testimonials: 0
    };
    const resNew = calcBniTrafficLightScore(newMember, 26);
    assert.strictEqual(resNew.weeksCount, 6);
    assert.strictEqual(resNew.rpw, 2.0);
    assert.strictEqual(resNew.ppw, 2.5);
    assert.strictEqual(resNew.ppwTier, 'high');
  });

  it('verifies flexible period selection elements exist in compiled index.html', () => {
    // Preset period pills
    assert.strictEqual(indexHtml.includes('id="palms-period-presets"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="4weeks"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="term2"'), true);
    assert.strictEqual(indexHtml.includes('data-preset="2years"'), true);

    // Custom date range controls
    assert.strictEqual(indexHtml.includes('id="palms-custom-period-bar"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-custom-start"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-custom-end"'), true);
    assert.strictEqual(indexHtml.includes('onclick="applyCustomPalmsPeriod()"'), true);

    // PPW and RPW KPI cards
    assert.strictEqual(indexHtml.includes('id="palms-kpi-avg-ppw"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-kpi-avg-rpw"'), true);

    // PPW Chart
    assert.strictEqual(indexHtml.includes('id="chart-palms-ppw-bar"'), true);

    // Metric filter buttons for PPW and RPW
    assert.strictEqual(indexHtml.includes('data-metric="ppw"'), true);
    assert.strictEqual(indexHtml.includes('data-metric="rpw"'), true);
  });

  it('verifies PALMS member detail modal UI elements and script functions exist', () => {
    // Modal container
    assert.strictEqual(indexHtml.includes('id="modal-palms-detail"'), true);
    assert.strictEqual(indexHtml.includes('id="modal-palms-container"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-name"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-tier-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-total-score"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-ppw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-rpw-value"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-scores-grid"'), true);
    
    // 7 Indicators Radar Chart (New Feature)
    assert.strictEqual(indexHtml.includes('id="chart-palms-detail-radar"'), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailRadar('), true);

    // Multi-period comparison table is removed per user request
    assert.strictEqual(indexHtml.includes('id="palms-detail-history-tbody"'), false);

    // Raw numbers
    assert.strictEqual(indexHtml.includes('id="palms-raw-p"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-raw-ref-total"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-raw-visitors"'), true);

    // Script functions
    assert.strictEqual(indexHtml.includes('function openPalmsDetailModal('), true);
    assert.strictEqual(indexHtml.includes('function closePalmsDetailModal('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailScores('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailRawBreakdown('), true);
    assert.strictEqual(indexHtml.includes('function fetchPalmsMemberHistory('), true);

    // ApiService mapping
    assert.strictEqual(indexHtml.includes('getPalmsMemberHistoryApi'), true);

    // Podium and Table calls openPalmsDetailModal
    assert.strictEqual(indexHtml.includes("openPalmsDetailModal('${memberNameSafe}')"), true);
  });

  it('verifies half-year PALMS submissions table and rendering function exist in compiled index.html', () => {
    // Weekly table container & badge
    assert.strictEqual(indexHtml.includes('id="palms-detail-weekly-tbody"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-detail-weekly-badge"'), true);
    assert.strictEqual(indexHtml.includes('活動実績・スリップ推移'), true);

    // Period switcher tabs (1month, 2months, 3months, half, 1year)
    assert.strictEqual(indexHtml.includes('id="palms-detail-period-tabs"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-period-tabs"'), true);
    assert.strictEqual(indexHtml.includes('data-period="1month"'), true);
    assert.strictEqual(indexHtml.includes('data-period="2months"'), true);
    assert.strictEqual(indexHtml.includes('data-period="3months"'), true);
    assert.strictEqual(indexHtml.includes('data-period="half"'), true);
    assert.strictEqual(indexHtml.includes('data-period="1year"'), true);

    // Trend chart canvas
    assert.strictEqual(indexHtml.includes('id="palms-detail-chart-history"'), true);
    assert.strictEqual(indexHtml.includes('id="member-palms-chart-history"'), true);

    // Script functions
    assert.strictEqual(indexHtml.includes('function renderPalmsDetailWeeklySubmissions('), true);
    assert.strictEqual(indexHtml.includes('function switchPalmsHistoryPeriod('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsHistoryChart('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsHistoryTable('), true);
    assert.strictEqual(indexHtml.includes('function getFilteredPalmsHistory('), true);
  });

  it('verifies GA4-style Date Range Modal and sidebar presets (All, 1M, 2M, 3M, 6M) exist and work in compiled index.html', () => {
    // Trigger button
    assert.strictEqual(indexHtml.includes('id="btn-open-palms-date-modal"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-period-display-label"'), true);

    // Modal container
    assert.strictEqual(indexHtml.includes('id="modal-palms-date-range"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-modal-sidebar"'), true);

    // Sidebar presets requested by USER: 全期間, １ヶ月, ２ヶ月, ３ヶ月, 半年
    assert.strictEqual(indexHtml.includes('data-preset-key="all"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="1month"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="2months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="3months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="term_2months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="term_3months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="6months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="custom"'), true);

    // Inputs, Tabs & Calendar
    assert.strictEqual(indexHtml.includes('id="palms-picker-tab-start"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-picker-tab-end"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-picker-guide-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-modal-start"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-modal-end"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-modal-duration-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-cal-left-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="palms-cal-right-grid"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-palms-modal-apply"'), true);

    // 1-Month & Multi-Month Unit Labels
    assert.strictEqual(indexHtml.includes('先月 (9月)'), true);
    assert.strictEqual(indexHtml.includes('先々月 (8月)'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="term_2months"'), true);
    assert.strictEqual(indexHtml.includes('data-preset-key="term_3months"'), true);
    assert.strictEqual(indexHtml.includes('type="date" id="palms-modal-start"'), true);
    assert.strictEqual(indexHtml.includes('type="date" id="palms-modal-end"'), true);

    // JS functions
    assert.strictEqual(indexHtml.includes('function openPalmsDateModal('), true);
    assert.strictEqual(indexHtml.includes('function closePalmsDateModal('), true);
    assert.strictEqual(indexHtml.includes('function setPalmsPickerActiveField('), true);
    assert.strictEqual(indexHtml.includes('function selectPalmsDatePreset('), true);
    assert.strictEqual(indexHtml.includes('function calcPalmsPresetRange('), true);
    assert.strictEqual(indexHtml.includes('function renderPalmsModalCalendars('), true);
    assert.strictEqual(indexHtml.includes('function movePalmsCalendarMonth('), true);
    assert.strictEqual(indexHtml.includes('function onPalmsCalendarDateClick('), true);
    assert.strictEqual(indexHtml.includes('function applyPalmsDateModal('), true);
    assert.strictEqual(indexHtml.includes('function updatePalmsPeriodDisplayLabel('), true);
  });

  it('verifies PALMS Ranking table header and row columns are strictly aligned (13 columns)', () => {
    // 1. Table header columns must match exactly
    const headerThRegex = /<th[^>]*>([\s\S]*?)<\/th>/g;
    const tableHeaderStart = indexHtml.indexOf('<tbody id="palms-table-body"');
    const tableBeforeTbody = indexHtml.substring(indexHtml.indexOf('id="palms-table-container"'), tableHeaderStart);
    
    const thMatches = [...tableBeforeTbody.matchAll(headerThRegex)];
    assert.strictEqual(thMatches.length, 13, 'Header must have exactly 13 columns');

    // Expected columns in order
    const expectedHeaders = [
      '順位', 'メンバー', '判定', '総合点', 'PPW', 'RPW',
      '内与', '外与', 'ビジター', '1to1', 'TYFCB', 'CEU', '出席率'
    ];

    expectedHeaders.forEach((name, idx) => {
      assert.ok(
        thMatches[idx][1].includes(name),
        `Column ${idx + 1} header should contain "${name}", got: ${thMatches[idx][1]}`
      );
    });

    // 2. Colspan for empty/loading states must be 13
    assert.strictEqual(indexHtml.includes('colspan="13"'), true);

    // 3. renderPalmsTable row HTML must render exactly 13 <td> elements per member
    const renderTableFnMatch = indexHtml.match(/function renderPalmsTable\(records\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(renderTableFnMatch, 'renderPalmsTable function must exist');

    const fnBody = renderTableFnMatch[1];
    // Check that inside records.forEach row template, all 13 columns are clearly laid out
    assert.ok(fnBody.includes('<!-- 1. 順位 -->'));
    assert.ok(fnBody.includes('<!-- 2. メンバー -->'));
    assert.ok(fnBody.includes('<!-- 3. 判定 -->'));
    assert.ok(fnBody.includes('<!-- 4. 総合点 -->'));
    assert.ok(fnBody.includes('<!-- 5. PPW -->'));
    assert.ok(fnBody.includes('<!-- 6. RPW -->'));
    assert.ok(fnBody.includes('<!-- 7. 内与 -->'));
    assert.ok(fnBody.includes('<!-- 8. 外与 -->'));
    assert.ok(fnBody.includes('<!-- 9. ビジター -->'));
    assert.ok(fnBody.includes('<!-- 10. 1to1 -->'));
    assert.ok(fnBody.includes('<!-- 11. TYFCB -->'));
    assert.ok(fnBody.includes('<!-- 12. CEU -->'));
    assert.ok(fnBody.includes('<!-- 13. 出席率 -->'));
  });

  it('verifies score-based semantic coloring and removal of arbitrary column colors in PALMS ranking', () => {
    // 1. Helper getPalmsScoreColorClass exists
    assert.ok(indexHtml.includes('function getPalmsScoreColorClass(score, maxScore)'));

    const helperMatch = indexHtml.match(/function getPalmsScoreColorClass\(score,\s*maxScore\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(helperMatch, 'getPalmsScoreColorClass function must exist');
    const getPalmsScoreColorClass = new Function('score', 'maxScore', helperMatch[1]);

    // Test scoring tiers
    assert.strictEqual(getPalmsScoreColorClass(25, 25), 'text-emerald-600 font-bold'); // 100% -> Green
    assert.strictEqual(getPalmsScoreColorClass(20, 25), 'text-emerald-600 font-bold'); // 80% -> Green
    assert.strictEqual(getPalmsScoreColorClass(15, 25), 'text-amber-600 font-bold');   // 60% -> Yellow
    assert.strictEqual(getPalmsScoreColorClass(5, 25), 'text-rose-600 font-bold');     // 20% -> Red
    assert.strictEqual(getPalmsScoreColorClass(0, 25), 'text-slate-400 font-medium');  // 0% -> Slate

    // 2. renderPalmsTable should use getPalmsScoreColorClass for items and not hardcoded item colors
    const renderTableFnMatch = indexHtml.match(/function renderPalmsTable\(records\)\s*\{([\s\S]*?)\n\}/);
    const tableBody = renderTableFnMatch[1];
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.referral, 25)'));
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.visitor, 25)'));
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.one_to_ones, 20)'));
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.tyfcb, 5)'));
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.ceu, 10)'));
    assert.ok(tableBody.includes('getPalmsScoreColorClass(tl.scores.attendance, 10)'));

    // Arbitrary item column colors must NOT exist in tableBody
    assert.strictEqual(tableBody.includes('text-indigo-600 font-semibold'), false);
    assert.strictEqual(tableBody.includes('text-purple-600 font-semibold'), false);
  });

  it('verifies selected period persistence and default to last month across view switches', () => {
    // 1. Initial default is last month (2026-09-01 ~ 2026-09-30)
    assert.ok(indexHtml.includes("startDate: '2026-09-01', endDate: '2026-09-30'"));
    assert.ok(indexHtml.includes("localStorage.getItem('revo_palms_selected_period')"));

    // 2. fetchPalmsPeriods prioritizes previously chosen period or last month
    assert.ok(indexHtml.includes('let targetStart = currentPalmsPeriod.startDate;'));
    assert.ok(indexHtml.includes('let targetEnd = currentPalmsPeriod.endDate;'));
    assert.ok(indexHtml.includes("calcPalmsPresetRange('1month')"));

    // 3. fetchPalmsRankingData respects target period and caches cleanly
    assert.ok(indexHtml.includes("const sTarget = startDate || currentPalmsPeriod.startDate || '2026-09-01';"));
    assert.ok(indexHtml.includes("const eTarget = endDate || currentPalmsPeriod.endDate || '2026-09-30';"));
  });

  it('verifies parseAndProcessPalmsRecords runs without ReferenceError and handles new and resigned members correctly', () => {
    const fnMatch = indexHtml.match(/function parseAndProcessPalmsRecords\(rawRecords,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fnMatch, 'parseAndProcessPalmsRecords function must exist');

    const tlFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(tlFnMatch, 'calcBniTrafficLightScore function must exist');

    const parseAndProcessPalmsRecords = new Function('rawRecords', 'weeks', `
      const calcBniTrafficLightScore = ${tlFnMatch[0]};
      const findMemberByName = (name) => {
        if (name === '退会テスト') return { name: '退会テスト', status: '退会' };
        return { name, status: '在籍' };
      };
      ${fnMatch[1]}
    `);

    const sampleRecords = [
      {
        member_name: '通常メンバー',
        p_present: 20, a_absent: 0, l_late: 0, m_medical: 0, s_substitute: 0,
        rgi_referrals_given_internal: 10,
        v_visitors: 2,
        one_to_ones: 15,
        tyfcb_amount: 500,
        ceu: 10
      },
      {
        member_name: '新会員メンバー',
        p_present: 2, a_absent: 0, l_late: 0, m_medical: 0, s_substitute: 0,
        rgi_referrals_given_internal: 2,
        v_visitors: 1,
        one_to_ones: 3,
        tyfcb_amount: 100,
        ceu: 2
      },
      {
        member_name: '退会テスト',
        p_present: 5, a_absent: 0, l_late: 0, m_medical: 0, s_substitute: 0,
        rgi_referrals_given_internal: 0,
        v_visitors: 0,
        one_to_ones: 0,
        tyfcb_amount: 0,
        ceu: 0
      }
    ];

    const processed = parseAndProcessPalmsRecords(sampleRecords, 20);
    assert.strictEqual(processed.length, 3);
    assert.strictEqual(processed[0].is_new_member, false);
    assert.strictEqual(processed[0].is_resigned, false);
    assert.strictEqual(processed[1].is_new_member, true);
    assert.strictEqual(processed[2].is_resigned, true);
  });

  it('verifies parseAndProcessPalmsRecords eliminates duplicate records for the same member', () => {
    const fnMatch = indexHtml.match(/function parseAndProcessPalmsRecords\(rawRecords,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(fnMatch);
    const tlFnMatch = indexHtml.match(/function calcBniTrafficLightScore\(r,\s*weeks\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(tlFnMatch);

    const parseAndProcessPalmsRecords = new Function('rawRecords', 'weeks', `
      const calcBniTrafficLightScore = ${tlFnMatch[0]};
      const findMemberByName = (name) => ({ name, status: '在籍' });
      ${fnMatch[1]}
    `);

    const duplicateRecords = [
      { member_name: '小山 世次', p_present: 10, rgi_referrals_given_internal: 5 },
      { member_name: '小山 世次', p_present: 10, rgi_referrals_given_internal: 5 },
      { member_name: '三島 文美', p_present: 12, rgi_referrals_given_internal: 8 },
      { member_name: '三島 文美', p_present: 12, rgi_referrals_given_internal: 8 }
    ];

    const deduplicated = parseAndProcessPalmsRecords(duplicateRecords, 13);
    assert.strictEqual(deduplicated.length, 2, 'Duplicates must be merged so each member appears exactly once');
    assert.strictEqual(deduplicated[0].member_name, '小山 世次');
    assert.strictEqual(deduplicated[1].member_name, '三島 文美');
  });
});




