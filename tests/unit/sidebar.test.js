const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Sidebar UI & Structure Tests', () => {
  it('verifies sidebar collapse/open buttons are removed and drawer elements are present', () => {
    const indexPath = path.join(__dirname, '../../index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    // Verify collapse/open buttons are completely removed
    assert.strictEqual(html.includes('id="btn-sidebar-collapse"'), false, 'btn-sidebar-collapse is removed');
    assert.strictEqual(html.includes('btn-sidebar-toggle-pc'), false, 'btn-sidebar-toggle-pc is removed');

    // Verify standard drawer navigation items exist
    assert.ok(html.includes('id="left-drawer"'), 'Has left drawer');
    assert.ok(html.includes('id="drawer-item-dashboard"'), 'Has dashboard nav item');
    assert.ok(html.includes('id="drawer-item-visitors"'), 'Has visitors nav item');
  });

  it('verifies standard clean responsive layout in public/css/base.css', () => {
    const cssPath = path.join(__dirname, '../../public/css/base.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.strictEqual(css.includes('.btn-sidebar-toggle-pc'), false, 'btn-sidebar-toggle-pc CSS is removed');
    assert.ok(css.includes('.left-drawer'), 'Has standard left-drawer CSS');
  });
});

