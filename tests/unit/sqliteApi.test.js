const assert = require('assert');
const path = require('path');
const ApiService = require(path.join(__dirname, '../../public/js/services/apiService.js'));

describe('SQLite REST ApiService Unit Tests', () => {
  it('has fallbackToGas method defined', () => {
    assert.strictEqual(typeof ApiService.fallbackToGas, 'function');
  });

  it('handles mocked fallback responses gracefully', async () => {
    const res = await ApiService.call('unknownMethod');
    assert.strictEqual(res.success, true);
  });
});
