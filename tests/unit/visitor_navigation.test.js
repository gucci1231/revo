const assert = require('assert');

function getAdjacentVisitorsFromList(list, currentVisitorId) {
  if (!list || list.length === 0 || !currentVisitorId) {
    return { prev: null, next: null, currentIndex: -1, total: 0 };
  }
  const currentIdStr = String(currentVisitorId);
  const idx = list.findIndex(v => {
    if (!v) return false;
    if (String(v.id) === currentIdStr) return true;
    if (v.allIds && Array.isArray(v.allIds)) {
      return v.allIds.some(id => String(id) === currentIdStr);
    }
    return false;
  });

  if (idx === -1) {
    return { prev: null, next: null, currentIndex: -1, total: list.length };
  }
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;
  return { prev, next, currentIndex: idx, total: list.length };
}

describe('Visitor Detail Swipe & Sequence Navigation Unit Tests', () => {
  const dummyList = [
    { id: 201, name: 'ビジター1' },
    { id: 202, name: 'ビジター2', allIds: [202, 102] },
    { id: 205, name: 'ビジター3' },
    { id: 208, name: 'ビジター4' }
  ];

  it('correctly finds prev and next visitor in middle of list', () => {
    const adj = getAdjacentVisitorsFromList(dummyList, 205);
    assert.strictEqual(adj.currentIndex, 2);
    assert.strictEqual(adj.total, 4);
    assert.strictEqual(adj.prev.id, 202);
    assert.strictEqual(adj.next.id, 208);
  });

  it('correctly handles first item boundary (prev is null)', () => {
    const adj = getAdjacentVisitorsFromList(dummyList, 201);
    assert.strictEqual(adj.currentIndex, 0);
    assert.strictEqual(adj.prev, null);
    assert.strictEqual(adj.next.id, 202);
  });

  it('correctly handles last item boundary (next is null)', () => {
    const adj = getAdjacentVisitorsFromList(dummyList, 208);
    assert.strictEqual(adj.currentIndex, 3);
    assert.strictEqual(adj.prev.id, 205);
    assert.strictEqual(adj.next, null);
  });

  it('correctly matches repeat visitor via allIds', () => {
    const adj = getAdjacentVisitorsFromList(dummyList, 102);
    assert.strictEqual(adj.currentIndex, 1);
    assert.strictEqual(adj.prev.id, 201);
    assert.strictEqual(adj.next.id, 205);
  });

  it('returns currentIndex -1 and nulls for not found visitor', () => {
    const adj = getAdjacentVisitorsFromList(dummyList, 9999);
    assert.strictEqual(adj.currentIndex, -1);
    assert.strictEqual(adj.total, 4);
    assert.strictEqual(adj.prev, null);
    assert.strictEqual(adj.next, null);
  });
});
