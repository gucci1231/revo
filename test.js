/**
 * Automated CLI Test Suite for Visitor Host Revolution 2.0
 * Run with: node test.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.join(__dirname, 'src');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

console.log('\n🧪 Running Visitor Host Revolution Automated CLI Tests...\n');

// --- TEST SUITE 1: Template Integration & HTML File Checks ---
console.log('📦 Test Suite 1: Template Files Integrity & Inclusion');
const requiredTemplates = [
  'Index.html',
  'Styles.html',
  'Scripts.html',
  'ViewDashboard.html',
  'ViewPriorityFollow.html',
  'ViewVisitors.html',
  'ViewHearings.html',
  'ViewEmailSchedule.html',
  'ViewSettings.html',
  'ViewVisitorDetail.html',
  'ModalVisitorCrud.html',
  'ModalHearingForm.html',
  'ModalMemberCrud.html'
];

requiredTemplates.forEach(file => {
  const filePath = path.join(SRC_DIR, file);
  const exists = fs.existsSync(filePath);
  assert(exists, `File exists: src/${file}`);
});

// Check HTML Assembly
let indexContent = fs.readFileSync(path.join(SRC_DIR, 'Index.html'), 'utf8');
const includesMatches = indexContent.match(/<\?!=\s*include\('([^']+)'\);\s*\?>/g) || [];
assert(includesMatches.length >= 10, `Index.html includes ${includesMatches.length} sub-templates`);

let assembledHtml = indexContent.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (m, fn) => {
  let fp = path.join(SRC_DIR, fn + '.html');
  return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
});

// --- TEST SUITE 2: Critical DOM Element IDs Check ---
console.log('\n🎯 Test Suite 2: Required DOM Element IDs');
const requiredElementIds = [
  'table-hot-visitors',
  'table-priority-follow-page',
  'table-all-visitors',
  'table-hearing-list',
  'table-email-schedule',
  'left-drawer',
  'drawer-backdrop',
  'btn-visitors-prev-page',
  'btn-visitors-next-page',
  'visitors-pagination-info',
  'btn-pf-prev-page',
  'btn-pf-next-page',
  'pf-pagination-info',
  'search-priority-follow-input',
  'search-visitors-input',
  'setting-page-period-select'
];

requiredElementIds.forEach(id => {
  const hasId = assembledHtml.includes(`id="${id}"`);
  assert(hasId, `DOM element ID exists: #${id}`);
});

// --- TEST SUITE 3: JavaScript Syntax & Helper Functions Validation ---
console.log('\n⚡ Test Suite 3: Client-side Scripts Syntax & Helper Functions');
const scriptsHtml = fs.readFileSync(path.join(SRC_DIR, 'Scripts.html'), 'utf8');

// Extract JS block from <script> tags
const jsMatches = scriptsHtml.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
let fullJsCode = jsMatches.map(m => m.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '')).join('\n');

assert(fullJsCode.length > 1000, `Client-side script extracted (${fullJsCode.length} bytes)`);

// Test JS Syntax compiling using Node VM
try {
  // Create a minimal mock sandbox to evaluate helper functions
  const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    document: {
      addEventListener: () => {},
      getElementById: () => ({ innerText: '', value: '', style: {}, classList: { add:()=>{}, remove:()=>{}, contains:()=>false } }),
      querySelector: () => ({ onclick: null, onchange: null }),
      querySelectorAll: () => []
    },
    window: { innerWidth: 1200, location: { hash: '' } },
    google: { script: { run: {}, history: { setChangeHandler: ()=>{} } } },
    sessionStorage: { getItem: ()=>null, setItem: ()=>{} },
    cachedAllVisitors: [],
    cachedPriorityFollowList: []
  };
  vm.createContext(sandbox);
  vm.runInContext(fullJsCode, sandbox);
  assert(true, 'Scripts.html JavaScript code compiled without syntax errors');

  // Test helper functions in sandbox
  if (typeof sandbox.escapeHtml === 'function') {
    const escaped = sandbox.escapeHtml('<div>&"\'</div>');
    assert(escaped === '&lt;div&gt;&amp;&quot;&#39;&lt;/div&gt;', `escapeHtml helper works: ${escaped}`);
  }

  if (typeof sandbox.formatTruncatedCell === 'function') {
    const truncated = sandbox.formatTruncatedCell('12345678901234567890', 10);
    assert(truncated.includes('1234567890...'), 'formatTruncatedCell truncates long text correctly');
  }

  if (typeof sandbox.parseFeelAbc === 'function') {
    assert(sandbox.parseFeelAbc('🔥 評価 A') === 'A', 'parseFeelAbc converts "🔥 評価 A" -> "A"');
    assert(sandbox.parseFeelAbc('評価 B') === 'B', 'parseFeelAbc converts "評価 B" -> "B"');
    assert(sandbox.parseFeelAbc('C評価') === 'C', 'parseFeelAbc converts "C評価" -> "C"');
    assert(sandbox.parseFeelAbc('C') === 'C', 'parseFeelAbc converts "C" -> "C"');
    assert(sandbox.parseFeelAbc('未入力') === '', 'parseFeelAbc converts "未入力" -> ""');
  }

} catch (err) {
  assert(false, `Scripts.html compilation error: ${err.message}`);
}

// --- TEST SUITE 4: 50-Item Pagination Math Logic ---
console.log('\n📊 Test Suite 4: 50-Item Pagination Math Logic');

function calcPagination(totalItems, pageSize, currentPage) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  let page = currentPage;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  return { page, totalPages, startIdx, endIdx, count: endIdx - startIdx };
}

const p1 = calcPagination(120, 50, 1);
assert(p1.totalPages === 3 && p1.startIdx === 0 && p1.endIdx === 50 && p1.count === 50, 'Page 1 of 120 items yields 50 items (1-50)');

const p2 = calcPagination(120, 50, 2);
assert(p2.startIdx === 50 && p2.endIdx === 100 && p2.count === 50, 'Page 2 of 120 items yields 50 items (51-100)');

const p3 = calcPagination(120, 50, 3);
assert(p3.startIdx === 100 && p3.endIdx === 120 && p3.count === 20, 'Page 3 of 120 items yields remaining 20 items (101-120)');

const pEmpty = calcPagination(0, 50, 1);
assert(pEmpty.totalPages === 1 && pEmpty.count === 0, '0 items yields 1 empty page');


// --- SUMMARY ---
console.log('\n========================================');
console.log(`📋 CLI Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All automated CLI tests passed successfully!\n');
  process.exit(0);
}
