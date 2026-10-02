const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📈 Step 6-6: Personalized Growth Engine (PGE) Feature Tests', () => {
  const growthServicePhp = fs.readFileSync(path.join(__dirname, '../../api/Services/GrowthAdvisorService.php'), 'utf8');
  const myPhpPath = path.join(__dirname, '../../my.php');
  const myPhpContent = fs.readFileSync(myPhpPath, 'utf8');
  const stat = fs.statSync(myPhpPath);

  it('verifies GrowthAdvisorService.php implements baby-step prescription and goal management', () => {
    assert.ok(growthServicePhp.includes('class GrowthAdvisorService'), 'GrowthAdvisorService class must exist');
    assert.ok(growthServicePhp.includes('generatePrescription'), 'generatePrescription method must exist');
    assert.ok(growthServicePhp.includes('acceptGoal'), 'acceptGoal method must exist');
    assert.ok(growthServicePhp.includes('generateWeeklyNudge'), 'generateWeeklyNudge method must exist');
  });

  it('verifies baby-step scoring target logic (Red->55, Yellow->70, Green->Elevated)', () => {
    assert.ok(growthServicePhp.includes("targetScore = 55"), 'Must target 55 points for red tier');
    assert.ok(growthServicePhp.includes("targetScore = 70"), 'Must target 70 points for yellow tier');
    assert.ok(growthServicePhp.includes('member_goals'), 'Must persist/query member_goals table');
    assert.ok(growthServicePhp.includes('acceptToken'), 'Must generate accept_goal action token');
  });

  it('verifies training event matching and weekly nudge generation', () => {
    assert.ok(growthServicePhp.includes('region_events'), 'Must match events from region_events');
    assert.ok(growthServicePhp.includes('generateWeeklyNudge'), 'Weekly encouragement nudge generator must exist');
  });

  it('verifies my.php integrates PGE prescription card and maintains <30KB footprint', () => {
    assert.ok(myPhpContent.includes('GrowthAdvisorService'), 'my.php must instantiate GrowthAdvisorService');
    assert.ok(myPhpContent.includes('今期のグロースプラン'), 'my.php must render growth plan card');
    assert.ok(myPhpContent.includes('このプランで挑戦する'), 'my.php must render 1-tap goal commitment button');
    assert.ok(myPhpContent.includes('おすすめ京都CC研修'), 'my.php must render matched Kyoto CC training recommendations');

    const sizeKb = stat.size / 1024;
    console.log(`    my.php size with PGE: ${sizeKb.toFixed(2)} KB (Target: < 30 KB)`);
    assert.ok(sizeKb < 30, `my.php must remain under 30KB, actual: ${sizeKb.toFixed(2)} KB`);
  });
});
