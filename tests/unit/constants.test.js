const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load constants file content
const constantsCode = fs.readFileSync(path.join(__dirname, '../../public/js/config/constants.js'), 'utf8');
eval(constantsCode);

describe('Constants & Parser Unit Tests', () => {
  it('parseFeelAbc correctly parses A, B, C ratings', () => {
    assert.strictEqual(parseFeelAbc('A'), 'A');
    assert.strictEqual(parseFeelAbc('b'), 'B');
    assert.strictEqual(parseFeelAbc(' Feel C '), 'C');
    assert.strictEqual(parseFeelAbc(''), '');
    assert.strictEqual(parseFeelAbc(null), '');
  });
});
