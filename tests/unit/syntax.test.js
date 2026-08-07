const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('HTML & JS Syntax Verification Tests', () => {
  it('verifies src/Scripts.html contains valid JavaScript syntax without syntax errors', () => {
    const filePath = path.join(__dirname, '../../src/Scripts.html');
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/<script[\s\S]*?>/gi, '').replace(/<\/script>/gi, '');

    assert.doesNotThrow(() => {
      new Function(code);
    }, SyntaxError, 'src/Scripts.html contains JavaScript syntax errors');
  });

  it('verifies compiled index.html script blocks contain valid JavaScript syntax', () => {
    const indexPath = path.join(__dirname, '../../index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const scriptMatches = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);

    assert.ok(scriptMatches && scriptMatches.length > 0, 'index.html has script blocks');

    scriptMatches.forEach((s, idx) => {
      const js = s.replace(/<script[\s\S]*?>/gi, '').replace(/<\/script>/gi, '');
      assert.doesNotThrow(() => {
        new Function(js);
      }, SyntaxError, `Script block ${idx} in index.html contains syntax errors`);
    });
  });
});
