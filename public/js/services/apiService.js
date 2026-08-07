/**
 * API Service Abstraction
 * Handles communication with Google Apps Script web backend or mock environment cleanly
 */
const ApiService = {
  call: function(functionName, ...args) {
    return new Promise((resolve, reject) => {
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
        // Fallback / mock
        console.warn(`[ApiService] Executing ${functionName} in mock environment`);
        resolve({ success: true, list: [], metrics: {} });
      }
    });
  }
};
