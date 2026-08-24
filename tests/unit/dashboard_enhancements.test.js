const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('Dashboard Enhancements & Intuitive UX Unit Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const viewDashboardHtml = fs.readFileSync(path.join(rootDir, 'src/ViewDashboard.html'), 'utf8');
  const viewDashboardScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewDashboard.html'), 'utf8');
  const utilsScript = fs.readFileSync(path.join(rootDir, 'src/scripts/Utils.html'), 'utf8');

  it('verifies HTML markup contains alerts banner and pipeline step card', () => {
    assert.match(viewDashboardHtml, /id="dash-today-alerts"/);
    assert.match(viewDashboardHtml, /id="dash-pipeline-card"/);
    assert.match(viewDashboardHtml, /id="dash-pipeline-grid"/);
    assert.match(viewDashboardHtml, /id="dash-hot-filter-all"/);
    assert.match(viewDashboardHtml, /id="dash-hot-filter-stagnant"/);
    assert.match(viewDashboardHtml, /id="dash-hot-filter-overdue"/);
    assert.match(viewDashboardHtml, /id="dash-hot-filter-active"/);
  });

  it('verifies pipeline step calculation logic correctly aggregates all 6 stages', () => {
    const rawScript = utilsScript.replace(/<\/?script>/g, '') + '\n' + viewDashboardScript.replace(/<\/?script>/g, '');
    
    // Mock DOM
    const gridElements = { innerHTML: '' };
    const context = {
      document: {
        getElementById: (id) => {
          if (id === 'dash-pipeline-grid') return gridElements;
          return { innerHTML: '', style: {}, classList: { add: () => {}, remove: () => {} } };
        }
      },
      cachedAllVisitors: [
        { id: 1, isJoined: '未' },
        { id: 2, isJoined: '未対応' },
        { id: 3, isJoined: '検討中' },
        { id: 4, isJoined: '申込書提出' },
        { id: 5, isJoined: '入金待ち' },
        { id: 6, isJoined: '審査' },
        { id: 7, isJoined: '入会済' },
        { id: 8, isJoined: '入会' }
      ],
      switchTab: () => {},
      console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(rawScript, context);

    context.renderDashboardPipelineBar(context.cachedAllVisitors);
    assert.ok(gridElements.innerHTML.includes('未対応'));
    assert.ok(gridElements.innerHTML.includes('検討中'));
    assert.ok(gridElements.innerHTML.includes('申込書提出'));
    assert.ok(gridElements.innerHTML.includes('入金待ち'));
    assert.ok(gridElements.innerHTML.includes('審査中'));
    assert.ok(gridElements.innerHTML.includes('入会済'));
    assert.ok(gridElements.innerHTML.includes('step-joined'));
  });

  it('verifies today alerts logic identifies overdue actions, stagnant hot visitors, and pending reapproach', () => {
    const rawScript = utilsScript.replace(/<\/?script>/g, '') + '\n' + viewDashboardScript.replace(/<\/?script>/g, '');
    
    const bannerEl = { innerHTML: '', style: {}, className: '' };
    const context = {
      document: {
        getElementById: (id) => {
          if (id === 'dash-today-alerts') return bannerEl;
          return { innerHTML: '', style: {}, classList: { add: () => {}, remove: () => {} } };
        }
      },
      switchTab: () => {},
      switchDashboardPanel: () => {},
      filterDashboardHotVisitors: () => {},
      console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(rawScript, context);

    const mockData = {
      tables: {
        actionPlans: [
          { id: 1, is_completed: 0, due_date: '2020-01-01', action_text: '超過アクション' }
        ],
        hotVisitors: [
          { id: 10, feelAbc: 'A', latestActionPlan: null } // 放置
        ],
        allVisitors: [
          { id: 20, followType: '時期尚早', reapproachDate: '2020-01-01' } // 再アプローチ到来
        ]
      }
    };

    context.renderDashboardAlerts(mockData);
    assert.strictEqual(bannerEl.style.display, 'flex');
    assert.ok(bannerEl.innerHTML.includes('期限超過'));
    assert.ok(bannerEl.innerHTML.includes('アクション未設定'));
    assert.ok(bannerEl.innerHTML.includes('再アプローチ'));
  });
});
