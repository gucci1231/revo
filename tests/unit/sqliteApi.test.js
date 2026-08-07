const assert = require('assert');
const path = require('path');
const ApiService = require(path.join(__dirname, '../../public/js/services/apiService.js'));

describe('SQLite REST ApiService Unit Tests', () => {
  it('has fallbackToGas method defined', () => {
    assert.strictEqual(typeof ApiService.fallbackToGas, 'function');
  });

  it('handles unknown method responses by rejecting', async () => {
    await assert.rejects(async () => {
      await ApiService.call('unknownMethod');
    });
  });

  it('correctly maps all frontend API calls in getRestConfig', () => {
    assert.strictEqual(ApiService.getRestConfig('getHearingListDataApi').url, '/api/hearings.php?action=list');
    assert.strictEqual(ApiService.getRestConfig('getHearingSheetsListApi').url, '/api/hearings.php?action=list');
    assert.strictEqual(ApiService.getRestConfig('getHearingSheetFormDataApi', ['142']).url, '/api/hearings.php?action=get&visitorId=142');
    assert.strictEqual(ApiService.getRestConfig('saveHearingSheetApi').url, '/api/hearings.php?action=save');
    assert.strictEqual(ApiService.getRestConfig('getDashboardDataApi').url, '/api/dashboard.php');
    assert.strictEqual(ApiService.getRestConfig('getAllVisitorsDataApi').url, '/api/visitors.php?action=list');
  });
});
