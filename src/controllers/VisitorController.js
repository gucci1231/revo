/**
 * Visitor Controller - API Handlers for Visitor Profile, Attendance & Status
 */
const VisitorController = {
  getAllVisitors: function() {
    return getAllVisitorsApi();
  },
  getVisitorDetail: function(id) {
    return getVisitorDetailApi(id);
  },
  addVisitor: function(data) {
    return addVisitorApi(data);
  },
  updateVisitor: function(data) {
    return updateVisitorApi(data);
  },
  deleteVisitor: function(id) {
    return deleteVisitorApi(id);
  },
  updateStatus: function(id, field, value) {
    return updateVisitorStatusApi(id, field, value);
  },
  saveMemo: function(id, memo) {
    return saveVisitorMemoApi(id, memo);
  }
};
