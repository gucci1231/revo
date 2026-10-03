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
          style: {},
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

  it('correctly prioritizes prospective candidates (undecided) in upcoming filterScope', () => {
    const today = sandbox.getTodayIsoDate();
    const parts = today.split('-');
    const nextWeek = `${parts[0]}-${parts[1]}-${String(Math.min(28, parseInt(parts[2], 10) + 7)).padStart(2, '0')}`;

    sandbox.cachedAllVisitors = [
      { id: '1', name: '過去ビジター', step1Coffee: '未', step1CoffeeDate: '', eventDate: '2024-01-01' },
      { id: '2', name: '来週ビジター', step1Coffee: '未', step1CoffeeDate: '', eventDate: nextWeek },
      { id: '3', name: '申込前候補者', step1Coffee: '未', step1CoffeeDate: '', eventDate: '' }
    ];

    const upcoming = sandbox.getCoffeeUnassignedVisitors('upcoming');
    assert.strictEqual(upcoming.length, 2, 'Should only contain prospective and future visitors');
    assert.strictEqual(upcoming[0].id, '3', 'Prospective (undecided) candidate must appear first');
    assert.strictEqual(upcoming[1].id, '2', 'Upcoming scheduled visitor must appear second');

    const past = sandbox.getCoffeeUnassignedVisitors('past');
    assert.strictEqual(past.length, 1, 'Should contain past visitor');
    assert.strictEqual(past[0].id, '1');
  });

  it('verifies search and filter elements exist in compiled index.html', () => {
    assert.ok(compiledIndexHtml.includes('id="coffee-visitor-search"'), 'Search input should exist');
    assert.ok(compiledIndexHtml.includes('id="btn-coffee-filter-upcoming"'), 'Filter button upcoming should exist');
    assert.ok(compiledIndexHtml.includes('openCoffeeAddVisitorModal'), 'Function openCoffeeAddVisitorModal should be referenced');
  });

  it('verifies openCoffeeAssignModal and closeCoffeeAssignModal toggle display property', () => {
    const mockModal = {
      id: 'modal-coffee-assign',
      style: { display: 'none' },
      classList: {
        add: () => {},
        remove: () => {}
      }
    };
    const origGetElementById = sandbox.document.getElementById;
    sandbox.document.getElementById = (id) => {
      if (id === 'modal-coffee-assign') return mockModal;
      return origGetElementById(id);
    };

    sandbox.openCoffeeAssignModal('2026-10-15');
    assert.strictEqual(mockModal.style.display, 'flex', 'openCoffeeAssignModal should set display to flex');

    sandbox.closeCoffeeAssignModal();
    assert.strictEqual(mockModal.style.display, 'none', 'closeCoffeeAssignModal should set display to none');

    sandbox.document.getElementById = origGetElementById;
  });

  it('verifies date picker, quick date buttons, and autocomplete elements exist in compiled index.html', () => {
    assert.ok(compiledIndexHtml.includes('id="cfa-target-date"'), 'Date picker input #cfa-target-date should exist');
    assert.ok(compiledIndexHtml.includes('setQuickCoffeeDate(\'today\')'), 'Quick date button today should exist');
    assert.ok(compiledIndexHtml.includes('setQuickCoffeeDate(\'tomorrow\')'), 'Quick date button tomorrow should exist');
    assert.ok(compiledIndexHtml.includes('setQuickCoffeeDate(\'next_weekday\')'), 'Quick date button next_weekday should exist');
    assert.ok(compiledIndexHtml.includes('id="cfa-autocomplete-dropdown"'), 'Autocomplete dropdown #cfa-autocomplete-dropdown should exist');
    assert.ok(compiledIndexHtml.includes('handleCoffeeVisitorSearchInput'), 'Function handleCoffeeVisitorSearchInput should be referenced');
  });

  it('correctly sorts candidate visitors newest first (by eventDate DESC or ID DESC)', () => {
    sandbox.cachedAllVisitors = [
      { id: '1', name: '大昔ビジター', eventDate: '2025-01-10', step1Coffee: '未', step1CoffeeDate: '' },
      { id: '2', name: '先週ビジター', eventDate: '2026-09-20', step1Coffee: '未', step1CoffeeDate: '' },
      { id: '3', name: '最新来週ビジター', eventDate: '2026-10-15', step1Coffee: '未', step1CoffeeDate: '' },
      { id: '4', name: '申込前最新ビジター', eventDate: '', step1Coffee: '未', step1CoffeeDate: '' }
    ];

    const result = sandbox.getSortedCoffeeCandidates('');
    assert.ok(result.unassigned.length === 4, 'All 4 should be unassigned');
    // Newest eventDate first (2026-10-15 should be first)
    assert.strictEqual(result.unassigned[0].name, '最新来週ビジター', 'Newest eventDate should be ranked first');
    assert.strictEqual(result.unassigned[1].name, '先週ビジター', 'Second newest eventDate should be ranked second');
    assert.strictEqual(result.unassigned[2].name, '大昔ビジター', 'Oldest eventDate should be ranked third');
    assert.strictEqual(result.unassigned[3].name, '申込前最新ビジター', 'Undated candidate should be ranked last among unassigned');
  });

  it('verifies visitor detail view links to openCoffeeAssignModal', () => {
    const vdFile = path.join(__dirname, '../../src/ViewVisitorDetail.html');
    const vdScriptFile = path.join(__dirname, '../../src/scripts/ViewVisitorDetail.html');
    const vdHtml = fs.readFileSync(vdFile, 'utf8');
    const vdScript = fs.readFileSync(vdScriptFile, 'utf8');

    // Header and action buttons contain coffee assign modal triggers
    assert.ok(vdHtml.includes('openCoffeeAssignModal(null, currentVdVisitorId)'), 'Visitor detail header/actions should link to openCoffeeAssignModal');
    // openQuickCoffeeMeetingModal delegates to openCoffeeAssignModal
    assert.ok(vdScript.includes('openCoffeeAssignModal(null, vid)'), 'openQuickCoffeeMeetingModal should delegate to openCoffeeAssignModal');
  });
});
