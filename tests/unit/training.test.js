const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseDetailHtml } = require('../../scripts/fetch_region_events');

describe('🎓 BNI Kyoto City Central Training & Event Features', () => {
  const indexPath = path.join(__dirname, '../../index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  it('verifies Training View container and 4 KPI cards exist in compiled index.html', () => {
    assert.ok(indexContent.includes('id="view-training"'), 'view-training container exists');
    assert.ok(indexContent.includes('id="kpi-training-next-date"'), 'Next event date KPI exists');
    assert.ok(indexContent.includes('id="kpi-training-month-count"'), 'Month count KPI exists');
    assert.ok(indexContent.includes('id="kpi-training-online-count"'), 'Online count KPI exists');
    assert.ok(indexContent.includes('id="kpi-training-inperson-count"'), 'In-person count KPI exists');
    assert.ok(indexContent.includes('id="training-last-synced"'), 'Last synced display exists');
    assert.ok(indexContent.includes('id="btn-sync-training"'), 'Sync button exists');
  });

  it('verifies filter controls and detailed modal exist in compiled index.html', () => {
    assert.ok(indexContent.includes('id="training-format-filters"'), 'Format filter pills exist');
    assert.ok(indexContent.includes('id="training-month-tabs"'), 'Month tabs container exists');
    assert.ok(indexContent.includes('id="training-category-select"'), 'Category select dropdown exists');
    assert.ok(indexContent.includes('id="training-search-input"'), 'Keyword search input exists');
    assert.ok(indexContent.includes('id="training-scope-select"'), 'Scope selector exists');
    assert.ok(indexContent.includes('id="training-events-list"'), 'Events list container exists');
    assert.ok(indexContent.includes('id="modal-training-detail"'), 'Detail modal exists');
    assert.ok(indexContent.includes('id="modal-ev-apply-btn"'), 'Modal application link button exists');
  });

  it('verifies Training View JS functions are defined in scripts', () => {
    const scriptPath = path.join(__dirname, '../../src/scripts/ViewTraining.html');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    assert.ok(scriptContent.includes('function initTrainingView()'), 'initTrainingView defined');
    assert.ok(scriptContent.includes('function loadTrainingEvents()'), 'loadTrainingEvents defined');
    assert.ok(scriptContent.includes('function renderTrainingKpis('), 'renderTrainingKpis defined');
    assert.ok(scriptContent.includes('function renderFilteredTrainingEvents()'), 'renderFilteredTrainingEvents defined');
    assert.ok(scriptContent.includes('function setTrainingFormatFilter('), 'setTrainingFormatFilter defined');
    assert.ok(scriptContent.includes('function setTrainingMonthFilter('), 'setTrainingMonthFilter defined');
    assert.ok(scriptContent.includes('function syncTrainingEvents()'), 'syncTrainingEvents defined');
    assert.ok(scriptContent.includes('function openTrainingDetailModal('), 'openTrainingDetailModal defined');
    assert.ok(scriptContent.includes('function closeTrainingDetailModal()'), 'closeTrainingDetailModal defined');
  });

  it('verifies ApiService mappings exist for Training & Event endpoints', () => {
    const apiServicePath = path.join(__dirname, '../../src/ApiService.html');
    const apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');

    assert.ok(apiServiceContent.includes("case 'getTrainingEventsApi':"), 'getTrainingEventsApi mapping exists');
    assert.ok(apiServiceContent.includes("case 'getEventDetailApi':"), 'getEventDetailApi mapping exists');
    assert.ok(apiServiceContent.includes("case 'syncTrainingEventsApi':"), 'syncTrainingEventsApi mapping exists');
    assert.ok(apiServiceContent.includes("case 'getEventCategoriesApi':"), 'getEventCategoriesApi mapping exists');
    assert.ok(apiServiceContent.includes("case 'getEventSummaryApi':"), 'getEventSummaryApi mapping exists');
  });

  it('verifies Router handles training tab properly without dev alert', () => {
    const routerPath = path.join(__dirname, '../../src/scripts/Router.html');
    const routerContent = fs.readFileSync(routerPath, 'utf8');

    assert.ok(routerContent.includes("'training': { title: 'トレーニング・研修日程', icon: 'fa-solid fa-graduation-cap' }"), 'PAGE_NAV_INFO includes clean training entry');
    assert.ok(!routerContent.includes("'training': '京都シティセントラル トレーニング・イベント自動取得'"), 'training is removed from dev placeholder alert');
    assert.ok(routerContent.includes("if (tabName === 'training' && typeof initTrainingView === 'function')"), 'switchTab calls initTrainingView');
  });

  it('verifies parseDetailHtml parses online event details accurately', () => {
    const sampleOnlineHtml = `
      <div class="holder headingRow">
        <h2>チャプターディベロップメント【全国対応】</h2>
      </div>
      <div class="holder threeColRow">
        <div class="col-xs-12 col-sm-12 col-md-4"><p>オンライン開催です。ZOOMにて行います。</p></div>
        <div class="col-xs-12 col-sm-6 col-md-4">
          <div class="box"><h3>担当者</h3>
            <div class="rCol"><p>松岡 正浩<br/>Phone No: 0728003380<br/></p></div>
            <h4><span>価格（BNIメンバー）:</span>JPY 2000.00</h4>
            <h4><span>価格（BNIメンバー以外）:</span>JPY 0.00</h4>
          </div>
        </div>
        <div class="col-xs-12 col-sm-6 col-md-4 lastCol">
          <div class="box"><h3>開催地</h3>
            <p class="address">オンライン（BNI online）<br/></p>
            <h4><span>定員:</span>40</h4>
            <h4><span>登録数:</span>5</h4>
          </div>
        </div>
      </div>
      <a href="https://www.bniconnectglobal.com/web/secure/appsEventsViewEventDetails?eventId=535582" target="_blank">参加申込（BNIメンバー）</a>
    `;

    const detail = parseDetailHtml(sampleOnlineHtml);
    assert.strictEqual(detail.is_online, 1, 'Should detect online event');
    assert.strictEqual(detail.contact_name, '松岡 正浩');
    assert.strictEqual(detail.contact_phone, '0728003380');
    assert.strictEqual(detail.cost_member, 'JPY 2000.00');
    assert.strictEqual(detail.max_attendees, 40);
    assert.strictEqual(detail.num_registered, 5);
    assert.strictEqual(detail.location_name, 'オンライン（BNI online）');
    assert.strictEqual(detail.registration_url, 'https://www.bniconnectglobal.com/web/secure/appsEventsViewEventDetails?eventId=535582');
  });

  it('verifies parseDetailHtml parses in-person event details and Google Maps URL accurately', () => {
    const sampleInPersonHtml = `
      <div class="holder headingRow">
        <h2>BNIベーシック・トレーニング（対面開催）</h2>
      </div>
      <div class="holder threeColRow">
        <div class="col-xs-12 col-sm-12 col-md-4"><p>京都経済センターでの対面集合研修です。</p></div>
        <div class="col-xs-12 col-sm-6 col-md-4">
          <div class="box"><h3>担当者</h3>
            <div class="rCol"><p>小木曽 貴弘<br/>Phone No: 075-371-6817<br/></p></div>
            <h4><span>価格（BNIメンバー）:</span>JPY 10000.00</h4>
          </div>
        </div>
        <div class="col-xs-12 col-sm-6 col-md-4 lastCol">
          <div class="box"><h3>開催地</h3>
            <p class="address">京都経済センター 会議室<br/>京都市下京区四条通室町東入函谷鉾町78番地<br/><a href='https://goo.gl/maps/7dQRpLcqxxkSDpXZ9' target='_blank' class='vieweventlocation'>View Map</a><br></p>
            <h4><span>定員:</span>30</h4>
            <h4><span>登録数:</span>12</h4>
          </div>
        </div>
      </div>
    `;

    const detail = parseDetailHtml(sampleInPersonHtml);
    assert.strictEqual(detail.is_online, 0, 'Should detect in-person event');
    assert.strictEqual(detail.contact_name, '小木曽 貴弘');
    assert.strictEqual(detail.contact_phone, '075-371-6817');
    assert.strictEqual(detail.cost_member, 'JPY 10000.00');
    assert.strictEqual(detail.max_attendees, 30);
    assert.strictEqual(detail.num_registered, 12);
    assert.strictEqual(detail.location_name, '京都経済センター 会議室');
    assert.strictEqual(detail.location_map_url, 'https://goo.gl/maps/7dQRpLcqxxkSDpXZ9');
  });

  it('verifies region_events table in SQLite database contains events and settings has last sync time', () => {
    const dbPath = path.join(__dirname, '../../api/data/database.sqlite');
    const countOutput = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM region_events;"`).toString().trim();
    const count = parseInt(countOutput, 10);
    assert.ok(count > 0, `region_events should have events (got ${count})`);

    const syncOutput = execSync(`sqlite3 "${dbPath}" "SELECT value FROM settings WHERE key = 'last_events_synced_at';"`).toString().trim();
    assert.ok(syncOutput.length > 0, 'settings should contain last_events_synced_at');
  });
});
