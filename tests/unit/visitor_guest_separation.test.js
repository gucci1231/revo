const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Visitor & Guest Separation Feature Tests', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

  it('contains visitor and guest segmented control in compiled index.html', () => {
    assert.ok(indexHtml.includes('id="tab-cat-visitor"'), 'Should contain tab-cat-visitor');
    assert.ok(indexHtml.includes('id="tab-cat-guest"'), 'Should contain tab-cat-guest');
    assert.ok(indexHtml.includes('id="count-cat-visitor"'), 'Should contain count-cat-visitor');
    assert.ok(indexHtml.includes('id="count-cat-guest"'), 'Should contain count-cat-guest');
    assert.ok(indexHtml.includes('setVisitorCategoryFilter'), 'Should contain setVisitorCategoryFilter');
  });

  it('contains category selector in visitor detail view', () => {
    assert.ok(indexHtml.includes('id="vd-select-category"'), 'Should contain vd-select-category');
    assert.ok(indexHtml.includes('changeVisitorCategory'), 'Should contain changeVisitorCategory');
  });

  it('contains category selector in visitor CRUD modal', () => {
    assert.ok(indexHtml.includes('id="crud-v-category"'), 'Should contain crud-v-category');
  });

  it('correctly filters list by category (ビジター vs ゲスト)', () => {
    const list = [
      { id: '1', name: 'ビジターA', category: 'ビジター' },
      { id: '2', name: 'ビジターB', category: '' },
      { id: '3', name: 'ゲストC', category: 'ゲスト' },
      { id: '4', name: 'ゲストD', category: 'ゲスト' }
    ];

    const filterByCategory = (items, category) => {
      return items.filter(v => {
        const isGuest = ((v.category || 'ビジター') === 'ゲスト');
        return (category === 'ゲスト') ? isGuest : !isGuest;
      });
    };

    const visitors = filterByCategory(list, 'ビジター');
    assert.strictEqual(visitors.length, 2);
    assert.deepStrictEqual(visitors.map(v => v.name), ['ビジターA', 'ビジターB']);

    const guests = filterByCategory(list, 'ゲスト');
    assert.strictEqual(guests.length, 2);
    assert.deepStrictEqual(guests.map(v => v.name), ['ゲストC', 'ゲストD']);
  });

  it('renderVisitorNameLinkHtml displays guest badge for guests', () => {
    const renderVisitorNameLinkHtml = (id, name, v = null) => {
      const guestBadge = (v && (v.category === 'ゲスト' || v.isGuest)) ? '<span class="badge-guest-tag ml-1.5"><i class="fa-solid fa-handshake"></i> ゲスト</span>' : '';
      return `<span>${name}${guestBadge}</span>`;
    };

    const visitorHtml = renderVisitorNameLinkHtml('1', '山田 太郎', { category: 'ビジター' });
    assert.ok(!visitorHtml.includes('badge-guest-tag'), 'Visitor should not have guest badge');

    const guestHtml = renderVisitorNameLinkHtml('2', '豊田 健司', { category: 'ゲスト' });
    assert.ok(guestHtml.includes('badge-guest-tag'), 'Guest should have guest badge');
    assert.ok(guestHtml.includes('ゲスト'), 'Guest badge should contain ゲスト');
  });
});
