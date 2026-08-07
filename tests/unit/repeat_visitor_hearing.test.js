const assert = require('assert');

// TDD Unit Test: Repeat Visitor Hearing Sheet Sync Logic
describe('Repeat Visitor Hearing Sheet Synchronization Unit Tests', () => {
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

  function syncHearingSheetForRepeatVisitors(visitorsList, hearingSheetsMap, targetId, newHearingData) {
    const linkedIds = getLinkedVisitorIds(visitorsList, targetId);
    linkedIds.forEach(id => {
      hearingSheetsMap[id] = { ...newHearingData, visitor_id: id };
    });
    return hearingSheetsMap;
  }

  it('correctly identifies all linked visitor IDs for a repeat visitor', () => {
    const mockVisitors = [
      { id: '85', visitor_name: '田中友規', email: 'seigenalex@icloud.com' },
      { id: '91', visitor_name: '田中　友規', email: 'seigenalex@icloud.com' },
      { id: '92', visitor_name: '田中友規', email: 'seigenalex@icloud.com' },
      { id: '96', visitor_name: '田中 友規', email: 'seigenalex@icloud.com' },
      { id: '100', visitor_name: '山田太郎', email: 'yamada@example.com' }
    ];

    const linkedFor92 = getLinkedVisitorIds(mockVisitors, '92');
    assert.deepStrictEqual(linkedFor92.sort(), ['85', '91', '92', '96'].sort());
  });

  it('synchronizes hearing sheet updates across all linked repeat visitor IDs', () => {
    const mockVisitors = [
      { id: '92', visitor_name: '田中友規', email: 'seigenalex@icloud.com' },
      { id: '96', visitor_name: '田中 友規', email: 'seigenalex@icloud.com' }
    ];

    let hearingSheets = {
      '92': { visitor_id: '92', q1: 'Old Q1', feel_abc: 'A' }
    };

    const updatedData = { q1: 'New Q1 Answer', feel_abc: 'B', orient_memo: 'Updated' };
    hearingSheets = syncHearingSheetForRepeatVisitors(mockVisitors, hearingSheets, '96', updatedData);

    assert.strictEqual(hearingSheets['92'].q1, 'New Q1 Answer');
    assert.strictEqual(hearingSheets['92'].feel_abc, 'B');
    assert.strictEqual(hearingSheets['96'].q1, 'New Q1 Answer');
    assert.strictEqual(hearingSheets['96'].feel_abc, 'B');
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
