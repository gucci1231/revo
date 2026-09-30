const assert = require('assert');
const { getDefaultWeeklyRange, toIsoDate, parsePalmsHtml } = require('../../scripts/fetch_bni_connect_palms.js');

describe('BNI Connect PALMS Crawler & Parser Unit Tests', () => {
  it('correctly calculates default weekly date range (last Thursday to this Thursday)', () => {
    const range = getDefaultWeeklyRange();
    assert.strictEqual(typeof range.startDate, 'string');
    assert.strictEqual(typeof range.endDate, 'string');

    // Both should match MM/DD/YYYY format
    assert.match(range.startDate, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.match(range.endDate, /^\d{2}\/\d{2}\/\d{4}$/);

    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    // End should be Thursday (4)
    assert.strictEqual(end.getDay(), 4);
    // Start should be Thursday (4)
    assert.strictEqual(start.getDay(), 4);
    // Difference should be exactly 7 days
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 7);
  });

  it('correctly converts MM/DD/YYYY to ISO YYYY-MM-DD', () => {
    assert.strictEqual(toIsoDate('09/24/2026'), '2026-09-24');
    assert.strictEqual(toIsoDate('04/01/2026'), '2026-04-01');
    assert.strictEqual(toIsoDate('2026-09-24'), '2026-09-24');
  });

  it('correctly parses PALMS HTML table into structured member records', () => {
    const sampleHtml = `
      <table class="reporttable">
        <tbody>
          <tr valign="top" align="left">
            <td colspan="2">
              <div>
                <a href="/web/secure/operationsRegionMembershipViewMember?memberId=3320086" target="_blank">小山 世次</a>
              </div>
            </td>
            <td><div style="text-align:right;">2</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">5</div></td>
            <td><div style="text-align:right;">5</div></td>
            <td><div style="text-align:right;">1</div></td>
            <td><div style="text-align:right;">2</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">7</div></td>
            <td><div style="text-align:right;">1130.00</div></td>
            <td><div style="text-align:right;">14</div></td>
            <td><div style="text-align:right;">1</div></td>
          </tr>
          <tr valign="top" align="left">
            <td colspan="2">
              <div>
                <a href="/web/secure/operationsRegionMembershipViewMember?memberId=3142959" target="_blank">川口 陽平</a>
              </div>
            </td>
            <td><div style="text-align:right;">2</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">1</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">4</div></td>
            <td><div style="text-align:right;">1</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">4</div></td>
            <td><div style="text-align:right;">0.00</div></td>
            <td><div style="text-align:right;">9</div></td>
            <td><div style="text-align:right;">0</div></td>
          </tr>
          <tr valign="top" align="left">
            <td colspan="2">
              <div>
                <a href="/web/secure/operationsRegionMembershipViewMember?memberId=9999999" target="_blank">ビジター</a>
              </div>
            </td>
            <td><div style="text-align:right;">2</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0.00</div></td>
            <td><div style="text-align:right;">0</div></td>
            <td><div style="text-align:right;">0</div></td>
          </tr>
        </tbody>
      </table>
    `;

    const records = parsePalmsHtml(sampleHtml, '09/17/2026', '09/24/2026');

    // Should ignore 'ビジター' row and parse 2 members
    assert.strictEqual(records.length, 2);

    const koyama = records.find(r => r.member_id === '3320086');
    assert.ok(koyama);
    assert.strictEqual(koyama.member_name, '小山 世次');
    assert.strictEqual(koyama.start_date, '2026-09-17');
    assert.strictEqual(koyama.end_date, '2026-09-24');
    assert.strictEqual(koyama.p_present, 2);
    assert.strictEqual(koyama.a_absent, 0);
    assert.strictEqual(koyama.l_late, 0);
    assert.strictEqual(koyama.rgi_referrals_given_internal, 5);
    assert.strictEqual(koyama.rgo_referrals_given_external, 5);
    assert.strictEqual(koyama.rri_referrals_received_internal, 1);
    assert.strictEqual(koyama.rro_referrals_received_external, 2);
    assert.strictEqual(koyama.v_visitors, 0);
    assert.strictEqual(koyama.one_to_ones, 7);
    assert.strictEqual(koyama.tyfcb_amount, 1130.0);
    assert.strictEqual(koyama.ceu, 14);
    assert.strictEqual(koyama.testimonials, 1);

    const kawaguchi = records.find(r => r.member_id === '3142959');
    assert.ok(kawaguchi);
    assert.strictEqual(kawaguchi.member_name, '川口 陽平');
    assert.strictEqual(kawaguchi.p_present, 2);
    assert.strictEqual(kawaguchi.rgi_referrals_given_internal, 1);
    assert.strictEqual(kawaguchi.rgo_referrals_given_external, 0);
    assert.strictEqual(kawaguchi.one_to_ones, 4);
    assert.strictEqual(kawaguchi.ceu, 9);
  });
});
