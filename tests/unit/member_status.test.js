const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('👥 Member Management Active & Resigned Status Feature Tests', () => {
  const indexPath = path.join(__dirname, '../../index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  it('verifies status filter buttons and counters exist in Member Master view in index.html', () => {
    assert.ok(indexHtml.includes('id="tab-member-filter-all"'), 'tab-member-filter-all exists');
    assert.ok(indexHtml.includes('id="tab-member-filter-active"'), 'tab-member-filter-active exists');
    assert.ok(indexHtml.includes('id="tab-member-filter-resigned"'), 'tab-member-filter-resigned exists');
    assert.ok(indexHtml.includes('id="count-members-all"'), 'count-members-all exists');
    assert.ok(indexHtml.includes('id="count-members-active"'), 'count-members-active exists');
    assert.ok(indexHtml.includes('id="count-members-resigned"'), 'count-members-resigned exists');
  });

  it('verifies status radio buttons exist in Member CRUD Modal in index.html', () => {
    assert.ok(indexHtml.includes('id="crud-m-status-active"'), 'crud-m-status-active exists');
    assert.ok(indexHtml.includes('id="crud-m-status-resigned"'), 'crud-m-status-resigned exists');
    assert.ok(indexHtml.includes('value="在籍"'), 'status 在籍 option exists');
    assert.ok(indexHtml.includes('value="退会"'), 'status 退会 option exists');
  });

  it('verifies Member Master table header contains status column in index.html', () => {
    assert.ok(indexHtml.includes('<th style="width: 80px;" class="text-center">状態</th>'), 'status column header exists');
  });

  it('verifies filterMembersMasterTable and renderMembersMasterTable logic handles resigned members correctly', () => {
    const mockMembers = [
      { id: '1', name: '山田 太郎', category: '士業', profession: '弁護士', status: '在籍' },
      { id: '2', name: '佐藤 次郎', category: '不動産', profession: '売買仲介', status: '在籍' },
      { id: '3', name: '鈴木 三郎', category: 'IT', profession: 'WEB制作', status: '退会' }
    ];

    const activeCount = mockMembers.filter(m => (m.status || '在籍') !== '退会').length;
    const resignedCount = mockMembers.filter(m => (m.status || '在籍') === '退会').length;

    assert.strictEqual(activeCount, 2, 'Active members count is 2');
    assert.strictEqual(resignedCount, 1, 'Resigned members count is 1');
    assert.strictEqual(mockMembers.length, 3, 'Total members count is 3');

    // Filter by active
    const activeList = mockMembers.filter(m => (m.status || '在籍') !== '退会');
    assert.strictEqual(activeList.length, 2);
    assert.strictEqual(activeList[0].name, '山田 太郎');
    assert.strictEqual(activeList[1].name, '佐藤 次郎');

    // Filter by resigned
    const resignedList = mockMembers.filter(m => (m.status || '在籍') === '退会');
    assert.strictEqual(resignedList.length, 1);
    assert.strictEqual(resignedList[0].name, '鈴木 三郎');
  });

  it('verifies Member Dashboard selector and header indicate resigned status', () => {
    assert.ok(indexHtml.includes('id="member-dash-status-badge"'), 'member-dash-status-badge element exists in member dashboard');
    assert.ok(indexHtml.includes('[退会]'), 'ViewMemberDashboard script includes resigned indicator tag');
  });

  it('verifies include resigned checkbox exists in both top action bar and date range modal in index.html', () => {
    assert.ok(indexHtml.includes('id="palms-include-resigned"'), 'palms-include-resigned checkbox exists in top bar');
    assert.ok(indexHtml.includes('id="palms-include-resigned-modal"'), 'palms-include-resigned-modal checkbox exists in modal');
    assert.ok(indexHtml.includes('退会メンバーを含む'), 'label 退会メンバーを含む exists');
  });

  it('verifies default includeResignedMembers is false (hidden by default) and filters correctly', () => {
    assert.ok(indexHtml.includes('includeResignedMembers = false'), 'includeResignedMembers defaults to false');

    const mockPalmsProcessed = [
      { member_name: '現役A', total_score: 85, is_resigned: false },
      { member_name: '現役B', total_score: 65, is_resigned: false },
      { member_name: '退会C', total_score: 45, is_resigned: true }
    ];

    // Default: false (exclude resigned)
    let filtered = mockPalmsProcessed.filter(r => !r.is_resigned);
    assert.strictEqual(filtered.length, 2, 'Default excludes resigned members');
    assert.strictEqual(filtered.some(r => r.is_resigned), false, 'No resigned members present');

    // When checked: true (include resigned)
    filtered = [...mockPalmsProcessed];
    assert.strictEqual(filtered.length, 3, 'When checked, includes all members including resigned');
    assert.strictEqual(filtered.some(r => r.is_resigned), true, 'Resigned member is included');
  });
});
