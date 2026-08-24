/**
 * Ultra-Fast REST API Bridge & Fallback Service
 */
const ApiService = {
  call: function(functionName, ...args) {
    const effectiveArgs = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
    return new Promise((resolve, reject) => {
      // 1. Try local SQLite REST API first (<10ms)
      const restConfig = this.getRestConfig(functionName, effectiveArgs);

      if (restConfig) {
        const fetchOptions = {
          method: restConfig.method || 'GET',
          headers: { 'Content-Type': 'application/json' }
        };
        if (restConfig.body) {
          fetchOptions.body = JSON.stringify(restConfig.body);
        }

        fetch(restConfig.url, fetchOptions)
          .then(res => res.json())
          .then(data => {
            if (data && data.success !== false) {
              resolve(data);
              return;
            }
            this.fallbackToGas(functionName, effectiveArgs, resolve, reject);
          })
          .catch(() => {
            this.fallbackToGas(functionName, effectiveArgs, resolve, reject);
          });
      } else {
        this.fallbackToGas(functionName, effectiveArgs, resolve, reject);
      }
    });
  },

  getRestConfig: function(functionName, args = []) {
    switch (functionName) {
      case 'getDashboardData':
      case 'getDashboardDataApi':
        return { url: '/api/dashboard.php', method: 'GET' };
      case 'getAllVisitorsApi':
      case 'getAllVisitorsDataApi':
        return { url: '/api/visitors.php?action=list', method: 'GET' };
      case 'getVisitorDetailApi':
        return { url: '/api/visitors.php?action=detail&id=' + (args[0] || ''), method: 'GET' };
      case 'updateVisitorStatusApi':
        return {
          url: '/api/visitors.php?action=update_status',
          method: 'POST',
          body: { visitorId: args[0], field: args[1], value: args[2] }
        };
      case 'saveVisitorMemoApi':
        return {
          url: '/api/visitors.php?action=save_memo',
          method: 'POST',
          body: { visitorId: args[0], memo: args[1] }
        };
      case 'addVisitorApi':
      case 'updateVisitorApi':
        return {
          url: '/api/visitors.php?action=add',
          method: 'POST',
          body: args[0] || {}
        };
      case 'deleteVisitorApi':
        return {
          url: '/api/visitors.php?action=delete',
          method: 'POST',
          body: { id: args[0] }
        };
      case 'getHearingSheetsListApi':
      case 'getHearingListDataApi':
        return { url: '/api/hearings.php?action=list', method: 'GET' };
      case 'getHearingSheetFormDataApi':
        return { url: '/api/hearings.php?action=get&visitorId=' + (args[0] || ''), method: 'GET' };
      case 'saveHearingSheetApi':
        return {
          url: '/api/hearings.php?action=save',
          method: 'POST',
          body: args[0] || {}
        };
      case 'getMembersApi':
      case 'getMemberListApi':
        return { url: '/api/members.php?action=list', method: 'GET' };
      case 'addMemberApi':
        return {
          url: '/api/members.php?action=add',
          method: 'POST',
          body: args[0] || {}
        };
      case 'updateMemberApi':
        return {
          url: '/api/members.php?action=update',
          method: 'POST',
          body: args[0] || {}
        };
      case 'deleteMemberApi':
        return {
          url: '/api/members.php?action=delete',
          method: 'POST',
          body: { id: args[0] }
        };
      case 'syncFormResponsesApi':
      case 'checkAndRepairDataFormatApi':
        return { url: '/api/sync.php', method: 'POST' };
      case 'updateSettingStartDateApi':
        return {
          url: '/api/settings.php?action=update',
          method: 'POST',
          body: { key: 'start_date', value: args[0] }
        };
      case 'getGoalsApi':
        return {
          url: '/api/settings.php?action=get_goals',
          method: 'GET'
        };
      case 'saveDefaultGoalsApi':
        return {
          url: '/api/settings.php?action=save_default_goals',
          method: 'POST',
          body: { goals: args[0] }
        };
      case 'saveMonthlyGoalApi':
        return {
          url: '/api/settings.php?action=save_monthly_goal',
          method: 'POST',
          body: { month: args[0], goals: args[1] }
        };
      case 'deleteMonthlyGoalApi':
        return {
          url: '/api/settings.php?action=delete_monthly_goal',
          method: 'POST',
          body: { month: args[0] }
        };
      case 'getActionPlansApi':
        return { url: '/api/action_plans.php?action=list&visitorId=' + (args[0] || ''), method: 'GET' };
      case 'getActionPlanDetailApi':
        return { url: '/api/action_plans.php?action=detail&id=' + (args[0] || ''), method: 'GET' };
      case 'createActionPlanApi':
        return {
          url: '/api/action_plans.php?action=create',
          method: 'POST',
          body: typeof args[0] === 'object' ? args[0] : { visitorId: args[0], dueDate: args[1], assigneeName: args[2], actionText: args[3], assigneeId: args[4] }
        };
      case 'updateActionPlanApi':
        return {
          url: '/api/action_plans.php?action=update',
          method: 'POST',
          body: typeof args[0] === 'object' ? args[0] : { id: args[0], dueDate: args[1], assigneeName: args[2], actionText: args[3], isCompleted: args[4] }
        };
      case 'toggleActionPlanApi':
        return {
          url: '/api/action_plans.php?action=toggle',
          method: 'POST',
          body: { id: args[0], isCompleted: args[1] }
        };
      case 'reportActionPlanApi':
        return {
          url: '/api/action_plans.php?action=report',
          method: 'POST',
          body: typeof args[0] === 'object' ? args[0] : { id: args[0], reportText: args[1], reporterName: args[2], isCompleted: args[3] }
        };
      case 'deleteActionPlanApi':
        return {
          url: '/api/action_plans.php?action=delete',
          method: 'POST',
          body: { id: args[0], visitorId: args[1] }
        };
      case 'getEmailTemplatesApi':
        return { url: '/api/email_templates.php?action=list', method: 'GET' };
      case 'updateEmailTemplateApi':
        return {
          url: '/api/email_templates.php?action=update',
          method: 'POST',
          body: typeof args[0] === 'object' ? args[0] : { id: args[0], subject: args[1], body: args[2] }
        };
      case 'sendEmailViaGasApi':
        return {
          url: '/api/email_templates.php?action=send',
          method: 'POST',
          body: typeof args[0] === 'object' ? args[0] : { visitorId: args[0], templateKey: args[1], customSubject: args[2], customBody: args[3] }
        };
      case 'getPriorityFollowDataApi':
        return { url: '/api/visitors.php?action=list', method: 'GET' };
      case 'getOgpApi':
        return { url: '/api/ogp.php?url=' + encodeURIComponent(args[0] || ''), method: 'GET' };
      case 'getScheduledEmailsApi':
        return null;
      default:
        return null;
    }
  },

  fallbackToGas: function(functionName, args, resolve, reject) {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      let runner = google.script.run
        .withSuccessHandler(res => resolve(res))
        .withFailureHandler(err => reject(err));
      if (typeof runner[functionName] === 'function') {
        runner[functionName](...args);
      } else {
        reject(new Error(`API method ${functionName} not found`));
      }
    } else {
      resolve({ success: true, list: [], metrics: {}, visitors: [], hearings: [] });
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
} else {
  (typeof window !== 'undefined' ? window : global).ApiService = ApiService;
}

