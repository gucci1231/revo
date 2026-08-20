const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const ApiService = require(path.join(__dirname, '../../public/js/services/apiService.js'));

describe('Goal Settings & Automatic Inheritance Feature Unit Tests', () => {
  it('correctly maps all Goals API endpoints in ApiService', () => {
    // 1. get_goals
    const getConfig = ApiService.getRestConfig('getGoalsApi', []);
    assert.strictEqual(getConfig.url, '/api/settings.php?action=get_goals');
    assert.strictEqual(getConfig.method, 'GET');

    // 2. save_default_goals
    const saveDefConfig = ApiService.getRestConfig('saveDefaultGoalsApi', [{
      target_joined: 3,
      target_visitors_weekly: 5,
      target_join_rate: 30.0,
      target_hearing_rate: 100.0
    }]);
    assert.strictEqual(saveDefConfig.url, '/api/settings.php?action=save_default_goals');
    assert.strictEqual(saveDefConfig.method, 'POST');
    assert.strictEqual(saveDefConfig.body.goals.target_joined, 3);
    assert.strictEqual(saveDefConfig.body.goals.target_visitors_weekly, 5);

    // 3. save_monthly_goal
    const saveMonthConfig = ApiService.getRestConfig('saveMonthlyGoalApi', ['2026/05', {
      target_joined: 4,
      target_visitors_weekly: 6,
      target_join_rate: 35.0,
      target_hearing_rate: 100.0
    }]);
    assert.strictEqual(saveMonthConfig.url, '/api/settings.php?action=save_monthly_goal');
    assert.strictEqual(saveMonthConfig.method, 'POST');
    assert.strictEqual(saveMonthConfig.body.month, '2026/05');
    assert.strictEqual(saveMonthConfig.body.goals.target_joined, 4);

    // 4. delete_monthly_goal
    const delMonthConfig = ApiService.getRestConfig('deleteMonthlyGoalApi', ['2026/05']);
    assert.strictEqual(delMonthConfig.url, '/api/settings.php?action=delete_monthly_goal');
    assert.strictEqual(delMonthConfig.method, 'POST');
    assert.strictEqual(delMonthConfig.body.month, '2026/05');
  });

  it('resolves month goals with automatic inheritance from previous month while keeping join/hearing rates at term level', () => {
    const defaultGoals = {
      target_joined: 2,
      target_visitors_weekly: 4,
      target_join_rate: 25.0,
      target_hearing_rate: 100.0
    };

    const monthlyMap = {
      '2026/04': { target_joined: 3, target_visitors_weekly: 5 },
      '2026/07': { target_joined: 4, target_visitors_weekly: 6 }
    };

    function resolveGoals(mStr) {
      const norm = mStr.replace(/-/g, '/').trim();
      const resolved = {
        target_join_rate: defaultGoals.target_join_rate,
        target_hearing_rate: defaultGoals.target_hearing_rate,
        target_joined: defaultGoals.target_joined,
        target_visitors_weekly: defaultGoals.target_visitors_weekly,
        month: norm,
        source: 'default',
        is_custom: false
      };

      if (monthlyMap[norm]) {
        resolved.target_joined = monthlyMap[norm].target_joined;
        resolved.target_visitors_weekly = monthlyMap[norm].target_visitors_weekly;
        resolved.source = 'custom';
        resolved.is_custom = true;
        return resolved;
      }
      const past = Object.keys(monthlyMap).filter(k => k < norm).sort().reverse();
      if (past.length > 0) {
        resolved.target_joined = monthlyMap[past[0]].target_joined;
        resolved.target_visitors_weekly = monthlyMap[past[0]].target_visitors_weekly;
        resolved.source = 'inherited';
        resolved.inherited_from = past[0];
        resolved.is_custom = false;
        return resolved;
      }
      return resolved;
    }

    // 2026/03: Before 2026/04 -> Falls back to default
    const gMar = resolveGoals('2026/03');
    assert.strictEqual(gMar.source, 'default');
    assert.strictEqual(gMar.target_joined, 2);
    assert.strictEqual(gMar.target_join_rate, 25.0);

    // 2026/04: Custom setting (only joined & visitors)
    const gApr = resolveGoals('2026/04');
    assert.strictEqual(gApr.source, 'custom');
    assert.strictEqual(gApr.target_joined, 3);
    assert.strictEqual(gApr.target_visitors_weekly, 5);
    assert.strictEqual(gApr.target_join_rate, 25.0);

    // 2026/05: Inherits from 2026/04
    const gMay = resolveGoals('2026/05');
    assert.strictEqual(gMay.source, 'inherited');
    assert.strictEqual(gMay.inherited_from, '2026/04');
    assert.strictEqual(gMay.target_joined, 3);
    assert.strictEqual(gMay.target_visitors_weekly, 5);
    assert.strictEqual(gMay.target_join_rate, 25.0);

    // 2026/06: Also inherits from 2026/04
    const gJun = resolveGoals('2026/06');
    assert.strictEqual(gJun.source, 'inherited');
    assert.strictEqual(gJun.inherited_from, '2026/04');
    assert.strictEqual(gJun.target_joined, 3);

    // 2026/07: Custom setting
    const gJul = resolveGoals('2026/07');
    assert.strictEqual(gJul.source, 'custom');
    assert.strictEqual(gJul.target_joined, 4);

    // 2026/08: Inherits from 2026/07
    const gAug = resolveGoals('2026/08');
    assert.strictEqual(gAug.source, 'inherited');
    assert.strictEqual(gAug.inherited_from, '2026/07');
    assert.strictEqual(gAug.target_joined, 4);
    assert.strictEqual(gAug.target_hearing_rate, 100.0);
  });
});
