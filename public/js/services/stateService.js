/**
 * Central Reactive State Manager
 */
const StateService = {
  currentDashboardData: null,
  cachedAllVisitors: [],
  cachedHearingList: [],
  cachedScheduledEmails: [],
  currentPreviewItem: null,
  currentVdVisitorId: "",
  currentVdWebAppUrl: "",

  setDashboardData: function(data) {
    this.currentDashboardData = data;
  },
  setAllVisitors: function(list) {
    this.cachedAllVisitors = list || [];
  },
  setHearingList: function(list) {
    this.cachedHearingList = list || [];
  },
  setScheduledEmails: function(list) {
    this.cachedScheduledEmails = list || [];
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateService;
} else {
  (typeof window !== 'undefined' ? window : global).StateService = StateService;
}
