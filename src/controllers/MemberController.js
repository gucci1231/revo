/**
 * Member Controller - API Handlers for Chapter Members Master
 */
const MemberController = {
  getMemberList: function() {
    return getMemberListApi();
  },
  addMember: function(memberObj) {
    return addMemberApi(memberObj);
  },
  updateMember: function(memberObj) {
    return updateMemberApi(memberObj);
  },
  deleteMember: function(memberId) {
    return deleteMemberApi(memberId);
  }
};
