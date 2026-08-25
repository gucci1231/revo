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

    // 6. report
    const reportConfig = ApiService.getRestConfig('reportActionPlanApi', [{
      id: 'ap_123',
      reportText: '1to1を実施し、次回定例会への参加意向を確認しました',
      reporterName: '川口 陽平',
      isCompleted: 1
    }]);
    assert.strictEqual(reportConfig.url, '/api/action_plans.php?action=report');
    assert.strictEqual(reportConfig.method, 'POST');
    assert.strictEqual(reportConfig.body.id, 'ap_123');
    assert.strictEqual(reportConfig.body.reportText, '1to1を実施し、次回定例会への参加意向を確認しました');
    assert.strictEqual(reportConfig.body.reporterName, '川口 陽平');
    assert.strictEqual(reportConfig.body.isCompleted, 1);
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

  it('correctly calculates pending and overdue counts for dashboard metrics', () => {
    const today = '2026-08-20';
    const plans = [
      { id: '1', due_date: '2026-08-15', is_completed: 0, visitor_id: '101', visitor_name: '田中' },
      { id: '2', due_date: '2026-08-25', is_completed: 0, visitor_id: '102', visitor_name: '佐藤' },
      { id: '3', due_date: '2026-08-10', is_completed: 1, visitor_id: '103', visitor_name: '鈴木' }
    ];

    const pendingCount = plans.filter(p => Number(p.is_completed) === 0).length;
    const overdueCount = plans.filter(p => Number(p.is_completed) === 0 && p.due_date < today).length;

    assert.strictEqual(pendingCount, 2);
    assert.strictEqual(overdueCount, 1);
  });

  it('correctly identifies completed vs pending visitors for one-month follow up list', () => {
    function isVisitorActionCompleted(r) {
      if (!r) return false;
      const ap = r.latestActionPlan;
      return !!(ap && Number(ap.is_completed) === 1);
    }

    const visitors = [
      { id: '1', name: '未対応（アクション未設定）', latestActionPlan: null },
      { id: '2', name: '対応中（未完了アクションあり）', latestActionPlan: { id: 'ap_1', is_completed: 0, action_text: '1to1' } },
      { id: '3', name: '完了済（アクション完了）', latestActionPlan: { id: 'ap_2', is_completed: 1, action_text: '入会確認完了' } }
    ];

    // isVisitorActionCompleted
    assert.strictEqual(isVisitorActionCompleted(visitors[0]), false);
    assert.strictEqual(isVisitorActionCompleted(visitors[1]), false);
    assert.strictEqual(isVisitorActionCompleted(visitors[2]), true);

    // Filter pending (default list: hides completed)
    const pendingList = visitors.filter(r => !isVisitorActionCompleted(r));
    assert.strictEqual(pendingList.length, 2);
    assert.deepStrictEqual(pendingList.map(v => v.id), ['1', '2']);

    // Filter completed
    const completedList = visitors.filter(r => isVisitorActionCompleted(r));
    assert.strictEqual(completedList.length, 1);
    assert.strictEqual(completedList[0].id, '3');
  });

  it('correctly partitions items into Kanban board columns (Overdue, Pending, Completed)', () => {
    const today = '2026-08-20';
    const plans = [
      { id: '1', due_date: '2026-08-15', is_completed: 0, action_text: '超過タスク' },
      { id: '2', due_date: '2026-08-20', is_completed: 0, action_text: '本日タスク' },
      { id: '3', due_date: '2026-08-25', is_completed: 0, action_text: '未来タスク' },
      { id: '4', due_date: '2026-08-10', is_completed: 1, action_text: '完了タスク' }
    ];

    const overdueItems = [];
    const pendingItems = [];
    const completedItems = [];

    plans.forEach(p => {
      const isCompleted = Number(p.is_completed) === 1;
      const isOverdue = !isCompleted && p.due_date && p.due_date < today;
      if (isCompleted) {
        completedItems.push(p);
      } else if (isOverdue) {
        overdueItems.push(p);
      } else {
        pendingItems.push(p);
      }
    });

    assert.strictEqual(overdueItems.length, 1);
    assert.strictEqual(overdueItems[0].id, '1');

    assert.strictEqual(pendingItems.length, 2);
    assert.deepStrictEqual(pendingItems.map(p => p.id), ['2', '3']);

    assert.strictEqual(completedItems.length, 1);
    assert.strictEqual(completedItems[0].id, '4');
  });

  it('correctly toggles no-action fallback display based on pending items count', () => {
    function shouldShowNoActionFallback(plans) {
      const pendingItems = (plans || []).filter(p => Number(p.is_completed) === 0);
      return pendingItems.length === 0;
    }

    // 1. アクションが0件の場合 -> true
    assert.strictEqual(shouldShowNoActionFallback([]), true);

    // 2. 完了済みアクションのみの場合 -> true (未完了が0件なのでヒアリング・メモを表示)
    assert.strictEqual(shouldShowNoActionFallback([
      { id: '1', action_text: '完了タスク', is_completed: 1 }
    ]), true);

    // 3. 未完了アクションが存在する場合 -> false (フォールバックは非表示)
    assert.strictEqual(shouldShowNoActionFallback([
      { id: '1', action_text: '進行中タスク', is_completed: 0 },
      { id: '2', action_text: '完了タスク', is_completed: 1 }
    ]), false);
  });

  it('correctly filters out or purges completed action plans older than 1 week (7 days)', () => {
    const now = new Date('2026-08-20T12:00:00Z').getTime();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    function isExpiredCompleted(p) {
      if (Number(p.is_completed) !== 1) return false;
      const targetDateStr = p.completed_at || p.updated_at;
      if (!targetDateStr) return false;
      const targetTs = new Date(targetDateStr.replace(/\//g, '-')).getTime();
      if (isNaN(targetTs)) return false;
      return targetTs < oneWeekAgo;
    }

    const plans = [
      { id: '1', action_text: '進行中タスク', is_completed: 0, updated_at: '2026-08-01 10:00:00' }, // 未完了（古くても削除されない）
      { id: '2', action_text: '昨日完了したタスク', is_completed: 1, completed_at: '2026-08-19 15:00:00' }, // 1日前の完了（保持）
      { id: '3', action_text: '5日前に完了したタスク', is_completed: 1, completed_at: '2026-08-15 10:00:00' }, // 5日前の完了（保持）
      { id: '4', action_text: '8日前に完了したタスク', is_completed: 1, completed_at: '2026-08-12 09:00:00' }, // 8日前の完了（削除対象）
      { id: '5', action_text: '30日前に完了したタスク', is_completed: 1, completed_at: '2026-07-20 10:00:00' } // 30日前の完了（削除対象）
    ];

    const activePlans = plans.filter(p => !isExpiredCompleted(p));
    assert.strictEqual(activePlans.length, 3);
    assert.deepStrictEqual(activePlans.map(p => p.id), ['1', '2', '3']);
  });

  it('correctly supports actionType in creation and rendering', () => {
    // 1. ApiService creates payload with actionType
    const createConfig = ApiService.getRestConfig('createActionPlanApi', [{
      visitorId: '225',
      dueDate: '2026-08-20',
      assigneeName: '川口 陽平',
      actionType: 'リファーラル',
      actionText: '案件打診と協業提案'
    }]);
    assert.strictEqual(createConfig.body.actionType, 'リファーラル');

    // 2. renderActionTypeBadgeHtml logic
    function renderActionTypeBadgeHtml(type) {
      if (!type) return '';
      const t = String(type).trim();
      let icon = 'fa-tag';
      if (t === '1to1') icon = 'fa-handshake';
      else if (t === 'リファーラル') icon = 'fa-gift';
      else if (t === '定例会案内' || t === '次回案内') icon = 'fa-calendar-day';
      else if (t === '入会案内') icon = 'fa-envelope-open-text';
      else if (t === '電話フォロー' || t === 'フォロー') icon = 'fa-phone';
      else if (t === 'その他') icon = 'fa-comment-dots';
      return `<span class="badge-action-type"><i class="fa-solid ${icon}"></i> ${t}</span>`;
    }

    assert(renderActionTypeBadgeHtml('1to1').includes('fa-handshake'));
    assert(renderActionTypeBadgeHtml('リファーラル').includes('fa-gift'));
    assert(renderActionTypeBadgeHtml('定例会案内').includes('fa-calendar-day'));
    assert(renderActionTypeBadgeHtml('入会案内').includes('fa-envelope-open-text'));
    assert(renderActionTypeBadgeHtml('電話フォロー').includes('fa-phone'));
    assert(renderActionTypeBadgeHtml('その他').includes('fa-comment-dots'));
    assert.strictEqual(renderActionTypeBadgeHtml(''), '');
  });
});



