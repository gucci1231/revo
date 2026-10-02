const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('🛡️ Step 6-8: 60-Day New Member Onboarding Track Feature Tests', () => {
  const onboardingPhp = fs.readFileSync(path.join(__dirname, '../../api/Services/OnboardingService.php'), 'utf8');
  const myPhpPath = path.join(__dirname, '../../my.php');
  const myPhpContent = fs.readFileSync(myPhpPath, 'utf8');
  const stat = fs.statSync(myPhpPath);

  it('verifies OnboardingService.php tracks 4 key milestones and detects stagnation', () => {
    assert.ok(onboardingPhp.includes('class OnboardingService'), 'OnboardingService class must exist');
    assert.ok(onboardingPhp.includes('getOnboardingMembers'), 'getOnboardingMembers method must exist');
    assert.ok(onboardingPhp.includes('evaluateMemberMilestones'), 'evaluateMemberMilestones method must exist');
    assert.ok(onboardingPhp.includes('generateCareCallText'), 'generateCareCallText method must exist');

    // 4 Key Milestones
    assert.ok(onboardingPhp.includes('first_1to1'), 'first_1to1 milestone must be tracked');
    assert.ok(onboardingPhp.includes('first_ceu'), 'first_ceu milestone must be tracked');
    assert.ok(onboardingPhp.includes('first_slip'), 'first_slip milestone must be tracked');
    assert.ok(onboardingPhp.includes('first_visitor'), 'first_visitor milestone must be tracked');
  });

  it('verifies Care Call Nudge for Buddy and Vice President upon stagnation', () => {
    assert.ok(onboardingPhp.includes('10分ケアコール推奨'), 'Must generate 10-minute care call recommendation');
    assert.ok(onboardingPhp.includes('urgentStagnations'), 'Must identify stagnant milestones');
  });

  it('verifies my.php includes 60-day onboarding track card and keeps <30KB footprint', () => {
    assert.ok(myPhpContent.includes('OnboardingService'), 'my.php must instantiate OnboardingService');
    assert.ok(myPhpContent.includes('初動60日オンボーディング'), 'my.php must render onboarding track card');
    assert.ok(myPhpContent.includes('careCallSuggestion'), 'my.php must display care call suggestion when urgent');

    const sizeKb = stat.size / 1024;
    console.log(`    my.php size with Onboarding Track: ${sizeKb.toFixed(2)} KB (Target: < 30 KB)`);
    assert.ok(sizeKb < 30, `my.php must remain under 30KB, actual: ${sizeKb.toFixed(2)} KB`);
  });
});
