const assert = require('assert');
const path = require('path');
const StateService = require(path.join(__dirname, '../../public/js/services/stateService.js'));

describe('StateService Unit Tests', () => {
  it('updates dashboard data correctly', () => {
    const mockData = { metrics: { applyCount: 10, joinedCount: 2 } };
    StateService.setDashboardData(mockData);
    assert.deepStrictEqual(StateService.currentDashboardData, mockData);
  });

  it('handles visitor list caching', () => {
    const mockList = [{ id: '1', name: 'テスト太郎' }];
    StateService.setAllVisitors(mockList);
    assert.strictEqual(StateService.cachedAllVisitors.length, 1);
    assert.strictEqual(StateService.cachedAllVisitors[0].name, 'テスト太郎');
  });
});
