const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('☕ Coffee Meeting Management & Slot Filling Calendar Unit Tests', () => {
  // 1. Load Utils.html and ViewCoffeeMeeting.html in a sandbox
  const utilsFile = path.join(__dirname, '../../src/scripts/Utils.html');
  const coffeeViewFile = path.join(__dirname, '../../src/scripts/ViewCoffeeMeeting.html');
  const modalCoffeeFile = path.join(__dirname, '../../src/scripts/ModalCoffeeAssign.html');
  const routerFile = path.join(__dirname, '../../src/scripts/Router.html');

  const utilsCode = fs.readFileSync(utilsFile, 'utf8').replace(/<\/?script>/gi, '');
  const coffeeViewCode = fs.readFileSync(coffeeViewFile, 'utf8').replace(/<\/?script>/gi, '');
  const modalCoffeeCode = fs.readFileSync(modalCoffeeFile, 'utf8').replace(/<\/?script>/gi, '');

  let lastCopiedText = '';
  const sandbox = {
    window: {},
    document: {
      getElementById: (id) => {
        return {
          id,
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          },
          querySelector: () => ({ className: '' }),
          textContent: '',
          innerHTML: '',
          value: '',
          disabled: false
        };
      },
      querySelectorAll: () => []
    },
    navigator: {
      clipboard: {
        writeText: async (text) => {
          lastCopiedText = text;
        }
      }
    },
    cachedAllVisitors: [],
    showToast: () => {},
    alert: () => {},
    confirm: () => true,
    prompt: () => {},
    escapeHtml: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    formatShortDate: d => d,
    formatEventDateWithElapsed: d => d
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(utilsCode, sandbox);
  vm.runInContext(coffeeViewCode, sandbox);
  vm.runInContext(modalCoffeeCode, sandbox);

  // 2. Load compiled index.html
  const compiledIndexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  it('verifies Coffee Meeting HTML elements exist in compiled index.html', () => {
    assert.ok(compiledIndexHtml.includes('id="drawer-item-coffee"'), 'Drawer item coffee should exist');
    assert.ok(compiledIndexHtml.includes('id="view-coffee"'), 'View container #view-coffee should exist');
    assert.ok(compiledIndexHtml.includes('id="kpi-coffee-next-date"'), 'KPI next date element should exist');
    assert.ok(compiledIndexHtml.includes('id="kpi-coffee-month-count"'), 'KPI month count element should exist');
    assert.ok(compiledIndexHtml.includes('id="kpi-coffee-empty-count"'), 'KPI empty count element should exist');
    assert.ok(compiledIndexHtml.includes('id="kpi-coffee-unassigned-count"'), 'KPI unassigned count element should exist');
    assert.ok(compiledIndexHtml.includes('id="btn-coffee-mode-month"'), 'Month view toggle button should exist');
    assert.ok(compiledIndexHtml.includes('id="btn-coffee-mode-week"'), 'Week view toggle button should exist');
    assert.ok(compiledIndexHtml.includes('id="coffee-month-cells"'), 'Month day cells container should exist');
    assert.ok(compiledIndexHtml.includes('id="coffee-week-cards"'), 'Week cards container should exist');
    assert.ok(compiledIndexHtml.includes('id="coffee-unassigned-visitors-pool"'), 'Unassigned pool container should exist');
    assert.ok(compiledIndexHtml.includes('id="modal-coffee-assign"'), 'Assignment modal #modal-coffee-assign should exist');
    assert.ok(compiledIndexHtml.includes('id="cfa-visitor-select"'), 'Visitor select in assignment modal should exist');
    assert.ok(compiledIndexHtml.includes('copyAvailableCoffeeSlotsText'), 'Copy available slots function call should exist');
  });

  it('verifies Router.html defines coffee route and handles tab switching', () => {
    const routerHtml = fs.readFileSync(routerFile, 'utf8');
    assert.ok(routerHtml.includes("'coffee': { title: 'コーヒーMTG管理'"), 'PAGE_NAV_INFO should include coffee');
    assert.ok(routerHtml.includes("allTabs = [") && routerHtml.includes("'coffee'"), 'allTabs should contain coffee');
    assert.ok(routerHtml.includes("tabName === 'coffee'"), 'switchTab should have a branch for coffee');
  });

  it('correctly maps booked visitors by date in sandbox getCoffeeVisitorsDateMap', () => {
    sandbox.cachedAllVisitors = [
      { id: '1', name: '田中 太郎', step1Coffee: '予定', step1CoffeeDate: '2026-10-15', inviter: '佐藤' },
      { id: '2', name: '鈴木 一郎', step1Coffee: '済', step1CoffeeDate: '2026-10-16', inviter: '高橋' },
      { id: '3', name: '未定 ビジター', step1Coffee: '未', step1CoffeeDate: '' }
    ];

    const map = sandbox.getCoffeeVisitorsDateMap();
    assert.strictEqual(map['2026-10-15'].length, 1);
    assert.strictEqual(map['2026-10-15'][0].name, '田中 太郎');
    assert.strictEqual(map['2026-10-16'].length, 1);
    assert.strictEqual(map['2026-10-16'][0].name, '鈴木 一郎');
    assert.strictEqual(map['2026-10-17'], undefined);
  });

  it('correctly filters unassigned candidates in sandbox getCoffeeUnassignedVisitors', () => {
    sandbox.cachedAllVisitors = [
      { id: '1', name: '確定ビジター1', step1Coffee: '予定', step1CoffeeDate: '2026-10-15' },
      { id: '2', name: '完了ビジター', step1Coffee: '済', step1CoffeeDate: '2026-10-10' },
      { id: '3', name: '未予約ビジター1', step1Coffee: '未', step1CoffeeDate: '', eventDate: '2026-10-22' },
      { id: '4', name: '未予約ビジター2', step1Coffee: '', step1CoffeeDate: '', eventDate: '2026-10-15' }
    ];

    const unassigned = sandbox.getCoffeeUnassignedVisitors();
    assert.strictEqual(unassigned.length, 2, 'Should identify 2 unassigned visitors');
    // Sort by eventDate ASC (10-15 before 10-22)
    assert.strictEqual(unassigned[0].id, '4');
    assert.strictEqual(unassigned[1].id, '3');
  });

  it('generates high-converting shareable empty slots text in copyAvailableCoffeeSlotsText', () => {
    sandbox.cachedAllVisitors = [];
    sandbox.copyAvailableCoffeeSlotsText();

    assert.ok(lastCopiedText.includes('平日 12:00〜12:30 事前コーヒーミーティング 空き日程'), 'Text should contain title');
    assert.ok(lastCopiedText.includes('12:00〜12:30 【空き枠】'), 'Text should list empty slots');
    assert.ok(lastCopiedText.includes('Zoom'), 'Text should mention Zoom');
  });
});
