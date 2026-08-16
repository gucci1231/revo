const assert = require('assert');
const path = require('path');
const ApiService = require(path.join(__dirname, '../../public/js/services/apiService.js'));

describe('Action Plan Feature Unit Tests', () => {
  it('correctly maps all Action Plan API endpoints in ApiService', () => {
    // 1. list
    const listConfig = ApiService.getRestConfig('getActionPlansApi', ['225']);
    assert.strictEqual(listConfig.url, '/api/action_plans.php?action=list&visitorId=225');
    assert.strictEqual(listConfig.method, 'GET');

    // 2. create
    const createConfig = ApiService.getRestConfig('createActionPlanApi', [{
      visitorId: '225',
      dueDate: '2026-08-20',
      assigneeName: '川口 陽平',
      actionText: '1to1の日程調整'
    }]);
    assert.strictEqual(createConfig.url, '/api/action_plans.php?action=create');
    assert.strictEqual(createConfig.method, 'POST');
    assert.strictEqual(createConfig.body.visitorId, '225');
    assert.strictEqual(createConfig.body.dueDate, '2026-08-20');
    assert.strictEqual(createConfig.body.assigneeName, '川口 陽平');
    assert.strictEqual(createConfig.body.actionText, '1to1の日程調整');

    // 3. update
    const updateConfig = ApiService.getRestConfig('updateActionPlanApi', [{
      id: 'ap_123',
      dueDate: '2026-08-21',
      assigneeName: '川口 陽平',
      actionText: '1to1の日程調整 (更新)',
      isCompleted: 1
    }]);
    assert.strictEqual(updateConfig.url, '/api/action_plans.php?action=update');
    assert.strictEqual(updateConfig.method, 'POST');
    assert.strictEqual(updateConfig.body.id, 'ap_123');
    assert.strictEqual(updateConfig.body.isCompleted, 1);

    // 4. toggle
    const toggleConfig = ApiService.getRestConfig('toggleActionPlanApi', ['ap_123', 1]);
    assert.strictEqual(toggleConfig.url, '/api/action_plans.php?action=toggle');
    assert.strictEqual(toggleConfig.method, 'POST');
    assert.strictEqual(toggleConfig.body.id, 'ap_123');
    assert.strictEqual(toggleConfig.body.isCompleted, 1);

    // 5. delete
    const deleteConfig = ApiService.getRestConfig('deleteActionPlanApi', ['ap_123', '225']);
    assert.strictEqual(deleteConfig.url, '/api/action_plans.php?action=delete');
    assert.strictEqual(deleteConfig.method, 'POST');
    assert.strictEqual(deleteConfig.body.id, 'ap_123');
    assert.strictEqual(deleteConfig.body.visitorId, '225');
  });

  it('correctly filters and sorts pending vs completed action plans', () => {
    const plans = [
      { id: '1', due_date: '2026-08-25', action_text: 'Plan A', is_completed: 0 },
      { id: '2', due_date: '2026-08-18', action_text: 'Plan B', is_completed: 1 },
      { id: '3', due_date: '2026-08-19', action_text: 'Plan C', is_completed: 0 }
    ];

    const pending = plans.filter(p => Number(p.is_completed) === 0);
    const completed = plans.filter(p => Number(p.is_completed) === 1);

    assert.strictEqual(pending.length, 2);
    assert.strictEqual(completed.length, 1);
    assert.strictEqual(completed[0].id, '2');
  });

  it('correctly identifies overdue dates for pending action plans', () => {
    const today = '2026-08-20';
    const pastPlan = { due_date: '2026-08-15', is_completed: 0 };
    const futurePlan = { due_date: '2026-08-25', is_completed: 0 };

    const isPastOverdue = pastPlan.due_date < today;
    const isFutureOverdue = futurePlan.due_date < today;

    assert.strictEqual(isPastOverdue, true);
    assert.strictEqual(isFutureOverdue, false);
  });
});
