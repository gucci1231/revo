const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.join(__dirname, '../../src');

function processIncludes(content) {
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, filename) => {
    let filePath = path.join(SRC_DIR, filename + '.html');
    if (fs.existsSync(filePath)) {
      let subContent = fs.readFileSync(filePath, 'utf8');
      return processIncludes(subContent);
    }
    return '';
  });
}

describe('PC & Mobile Sidebar / Drawer Collapse & Toggle Feature Tests', () => {
  it('verifies sidebar toggle elements and structure in compiled index.html', () => {
    const indexPath = path.join(__dirname, '../../index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    // Check sidebar collapse buttons
    assert.ok(html.includes('id="btn-sidebar-collapse"'), 'Has sidebar header collapse button');
    assert.ok(html.includes('btn-drawer-trigger'), 'Has header drawer trigger button');
    assert.ok(html.includes('data-tooltip="ダッシュボード"'), 'Has tooltip attributes for collapsed mode');
    assert.ok(html.includes('drawer-brand-text'), 'Has drawer brand text class for hiding when collapsed');
  });

  it('verifies sidebar styles for collapsed mode in public/css/base.css', () => {
    const cssPath = path.join(__dirname, '../../public/css/base.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('body.sidebar-collapsed'), 'Has body.sidebar-collapsed styles');
    assert.ok(css.includes('body.sidebar-collapsed .left-drawer'), 'Has left-drawer collapsed width');
    assert.ok(css.includes('data-tooltip'), 'Has tooltip display CSS rules');
    assert.ok(css.includes('.btn-sidebar-collapse'), 'Has .btn-sidebar-collapse CSS');
  });

  it('verifies toggleSidebarCollapse toggles class and updates localStorage in JS sandbox', () => {
    const scriptsRaw = fs.readFileSync(path.join(SRC_DIR, 'Scripts.html'), 'utf8');
    const fullScripts = processIncludes(scriptsRaw);
    const jsMatches = fullScripts.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi) || [];
    const jsCode = jsMatches.map(m => m.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '')).join('\n');

    let storedValues = {};
    let bodyClasses = new Set();
    let docClasses = new Set();
    let dispatchedEvents = [];

    const sandbox = {
      window: {
        innerWidth: 1200,
        location: { hash: '' },
        dispatchEvent: (evt) => { dispatchedEvents.push(evt.type); },
        addEventListener: () => {}
      },
      Event: function(type) { this.type = type; },
      document: {
        readyState: 'complete',
        documentElement: {
          classList: {
            add: (c) => docClasses.add(c),
            remove: (c) => docClasses.delete(c),
            contains: (c) => docClasses.has(c)
          }
        },
        body: {
          classList: {
            add: (c) => bodyClasses.add(c),
            remove: (c) => bodyClasses.delete(c),
            contains: (c) => bodyClasses.has(c),
            toggle: (c) => {
              if (bodyClasses.has(c)) {
                bodyClasses.delete(c);
                return false;
              } else {
                bodyClasses.add(c);
                return true;
              }
            }
          }
        },
        getElementById: () => null,
        addEventListener: () => {}
      },
      localStorage: {
        getItem: (key) => storedValues[key] || null,
        setItem: (key, val) => { storedValues[key] = String(val); }
      },
      setTimeout: (fn, delay) => { fn(); },
      console: console
    };

    vm.createContext(sandbox);
    vm.runInContext(jsCode, sandbox);

    assert.strictEqual(typeof sandbox.toggleSidebarCollapse, 'function', 'toggleSidebarCollapse is defined');

    // 1. Initial state (expanded)
    assert.strictEqual(bodyClasses.has('sidebar-collapsed'), false);

    // 2. Call toggle on PC (innerWidth = 1200) -> Collapses
    sandbox.toggleSidebarCollapse();
    assert.strictEqual(bodyClasses.has('sidebar-collapsed'), true, 'Body receives sidebar-collapsed class');
    assert.strictEqual(docClasses.has('sidebar-collapsed'), true, 'Doc receives sidebar-collapsed class');
    assert.strictEqual(storedValues['sidebar_collapsed'], 'true', 'localStorage is updated to "true"');

    // 3. Call toggle again -> Expands
    sandbox.toggleSidebarCollapse();
    assert.strictEqual(bodyClasses.has('sidebar-collapsed'), false, 'Body sidebar-collapsed is removed');
    assert.strictEqual(docClasses.has('sidebar-collapsed'), false, 'Doc sidebar-collapsed is removed');
    assert.strictEqual(storedValues['sidebar_collapsed'], 'false', 'localStorage is updated to "false"');
  });
});
