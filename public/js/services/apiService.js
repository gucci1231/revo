/**
 * Ultra-Fast REST API Bridge & Fallback Service
 */
const ApiService = {
  call: function(functionName, ...args) {
    return new Promise((resolve, reject) => {
      // 1. Try local SQLite REST API first (<10ms)
      const restConfig = this.getRestConfig(functionName, args);

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
            this.fallbackToGas(functionName, args, resolve, reject);
          })
          .catch(() => {
            this.fallbackToGas(functionName, args, resolve, reject);
          });
      } else {
        this.fallbackToGas(functionName, args, resolve, reject);
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
          body: { key: 'startDate', value: args[0] }
        };
      case 'getPriorityFollowDataApi':
        return { url: '/api/visitors.php?action=list', method: 'GET' };
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
      reject(new Error(`API request for ${functionName} failed on server.`));
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
} else {
  (typeof window !== 'undefined' ? window : global).ApiService = ApiService;
}

