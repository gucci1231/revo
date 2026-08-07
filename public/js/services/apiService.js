/**
 * Ultra-Fast REST API Bridge & Fallback Service
 */
const ApiService = {
  call: function(functionName, ...args) {
    return new Promise((resolve, reject) => {
      // 1. Try local SQLite REST API first (<10ms)
      const restEndpointMap = {
        'getDashboardData': '/api/dashboard.php',
        'getAllVisitorsApi': '/api/visitors.php?action=list',
        'getVisitorDetailApi': '/api/visitors.php?action=detail&id=' + (args[0] || ''),
        'getHearingSheetsListApi': '/api/hearings.php?action=list',
        'getMemberListApi': '/api/members.php?action=list',
        'syncFormResponsesApi': '/api/sync.php'
      };

      if (restEndpointMap[functionName]) {
        fetch(restEndpointMap[functionName])
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
      resolve({ success: true, list: [], metrics: {} });
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
} else {
  (typeof window !== 'undefined' ? window : global).ApiService = ApiService;
}
