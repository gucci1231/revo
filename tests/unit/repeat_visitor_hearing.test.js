const assert = require('assert');

// TDD Unit Test: Repeat Visitor Hearing Sheets & Action Plan Integration
describe('Repeat Visitor Multi-Hearing Sheet & Action Plan Integration Unit Tests', () => {
  function getLinkedVisitorIds(visitorsList, targetId) {
    const target = visitorsList.find(v => String(v.id) === String(targetId));
    if (!target) return [String(targetId)];

    const targetEmail = target.email ? target.email.trim().toLowerCase() : '';
    const targetName = target.visitor_name ? target.visitor_name.trim().replace(/[\s\u3000]+/g, '') : '';

    const linkedIds = visitorsList
      .filter(v => {
        const email = v.email ? v.email.trim().toLowerCase() : '';
        const name = v.visitor_name ? v.visitor_name.trim().replace(/[\s\u3000]+/g, '') : '';
        if (targetEmail && email === targetEmail) return true;
        if (targetName && targetName.length > 1 && name === targetName) return true;
        return String(v.id) === String(targetId);
      })
      .map(v => String(v.id));

    return Array.from(new Set(linkedIds));
  }

  it('correctly identifies all linked visitor IDs for a repeat visitor', () => {
    const mockVisitors = [
      { id: '221', visitor_name: '高原聖', email: 's.takahara@last-piece.com', event_date: '2026/07/30' },
      { id: '234', visitor_name: '高原 聖', email: 's.takahara@last-piece.com', event_date: '2026/08/20' },
      { id: '100', visitor_name: '山田太郎', email: 'yamada@example.com', event_date: '2026/08/01' }
    ];

    const linkedFor234 = getLinkedVisitorIds(mockVisitors, '234');
    assert.deepStrictEqual(linkedFor234.sort(), ['221', '234'].sort());
  });

  it('preserves independent hearing sheets for each visit while aggregating for visitor detail view', () => {
    const mockHearings = [
      { visitor_id: '221', orient_user: '上田', feel_abc: 'B', q1: '1回目の感想', updated_at: '2026/07/30' },
      { visitor_id: '234', orient_user: '阿部', feel_abc: 'A', q1: '2回目の感想', updated_at: '2026/08/20' }
    ];

    const linkedIds = ['221', '234'];
    const aggregatedHearings = mockHearings.filter(h => linkedIds.includes(h.visitor_id));

    assert.strictEqual(aggregatedHearings.length, 2);
    assert.strictEqual(aggregatedHearings.find(h => h.visitor_id === '221').q1, '1回目の感想');
    assert.strictEqual(aggregatedHearings.find(h => h.visitor_id === '234').q1, '2回目の感想');
  });

  it('aggregates action plans from all visits of a repeat visitor', () => {
    const mockActionPlans = [
      { id: 'ap_1', visitor_id: '221', action_text: '20日の定例会お誘い', is_completed: 0, due_date: '2026-08-17' },
      { id: 'ap_2', visitor_id: '234', action_text: '入会申込書フォロー', is_completed: 0, due_date: '2026-08-25' }
    ];

    const linkedIds = ['221', '234'];
    const plansFor234 = mockActionPlans.filter(ap => linkedIds.includes(ap.visitor_id));

    assert.strictEqual(plansFor234.length, 2);
    assert.strictEqual(plansFor234[0].action_text, '20日の定例会お誘い');
    assert.strictEqual(plansFor234[1].action_text, '入会申込書フォロー');
  });

  it('sorts hearing sheet list by participation date (eventDate DESC)', () => {
    const hearingList = [
      { visitorId: '10', name: 'Visitor A', eventDate: '2026/07/01' },
      { visitorId: '12', name: 'Visitor B', eventDate: '2026/08/08' },
      { visitorId: '11', name: 'Visitor C', eventDate: '2026/08/01' }
    ];

    hearingList.sort((a, b) => {
      const dA = a.eventDate || '';
      const dB = b.eventDate || '';
      if (dA !== dB) return dB.localeCompare(dA);
      return (parseInt(b.visitorId, 10) || 0) - (parseInt(a.visitorId, 10) || 0);
    });

    assert.deepStrictEqual(hearingList.map(r => r.visitorId), ['12', '11', '10']);
  });
});
