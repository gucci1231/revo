const assert = require('assert');

// TDD Unit Test: Repeat Visitor Status Synchronization (isAttended, isJoined, is1to1)
describe('Repeat Visitor Status Synchronization Unit Tests', () => {
  function getLinkedVisitorIds(visitorsList, targetId) {
    const target = visitorsList.find(v => v.id === targetId);
    if (!target) return [targetId];

    const targetEmail = target.email ? target.email.trim().toLowerCase() : '';
    const targetName = target.visitor_name ? target.visitor_name.trim().replace(/\s+/g, '') : '';

    const linkedIds = visitorsList
      .filter(v => {
        const email = v.email ? v.email.trim().toLowerCase() : '';
        const name = v.visitor_name ? v.visitor_name.trim().replace(/\s+/g, '') : '';
        if (targetEmail && email === targetEmail) return true;
        if (targetName && targetName.length > 1 && name === targetName) return true;
        return v.id === targetId;
      })
      .map(v => v.id);

    return Array.from(new Set(linkedIds));
  }

  function updateStatusForLinkedVisitors(visitorsList, statusMap, targetId, column, value) {
    const linkedIds = getLinkedVisitorIds(visitorsList, targetId);
    linkedIds.forEach(id => {
      if (!statusMap[id]) {
        statusMap[id] = { visitor_id: id, is_attended: '未', is_joined: '未', is_1to1: '未', is_matched: '未' };
      }
      statusMap[id][column] = value;
    });
    return statusMap;
  }

  it('synchronizes isJoined status across all linked repeat visitor IDs', () => {
    const mockVisitors = [
      { id: '85', visitor_name: '田中友規', email: 'seigenalex@icloud.com' },
      { id: '91', visitor_name: '田中　友規', email: 'seigenalex@icloud.com' },
      { id: '92', visitor_name: '田中友規', email: 'seigenalex@icloud.com' },
      { id: '96', visitor_name: '田中 友規', email: 'seigenalex@icloud.com' }
    ];

    let statusMap = {
      '85': { visitor_id: '85', is_joined: '未' },
      '91': { visitor_id: '91', is_joined: '未' },
      '92': { visitor_id: '92', is_joined: '未' },
      '96': { visitor_id: '96', is_joined: '未' }
    };

    // User clicks Join (入会済) on visitor ID 92
    statusMap = updateStatusForLinkedVisitors(mockVisitors, statusMap, '92', 'is_joined', '入会済');

    assert.strictEqual(statusMap['85'].is_joined, '入会済');
    assert.strictEqual(statusMap['91'].is_joined, '入会済');
    assert.strictEqual(statusMap['92'].is_joined, '入会済');
    assert.strictEqual(statusMap['96'].is_joined, '入会済');
  });
});
