const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Celebration Effect & Quest Clear Animation Unit Tests', () => {
  const effectHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/CelebrationEffect.html'), 'utf8');
  const compiledIndex = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  it('verifies CelebrationEffect module methods and overlay structure', () => {
    assert(effectHtml.includes('window.CelebrationEffect'), 'CelebrationEffect should be attached to window');
    assert(effectHtml.includes('trigger: trigger'), 'trigger method should be exposed');
    assert(effectHtml.includes('triggerQuestClear'), 'triggerQuestClear method should exist');
    assert(effectHtml.includes('playClearChime'), 'playClearChime method should exist');
    assert(effectHtml.includes('triggerScreenShake'), 'triggerScreenShake method should exist');
    assert(effectHtml.includes('celebration-sunburst'), 'Sunburst animation class should exist');
    assert(effectHtml.includes('celebration-shockwave'), 'Shockwave animation class should exist');
    assert(effectHtml.includes('celebration-screen-shake'), 'Screen shake class should exist');
  });

  it('verifies CelebrationEffect is compiled into index.html', () => {
    assert(compiledIndex.includes('CelebrationEffect'), 'Compiled index.html should contain CelebrationEffect');
    assert(compiledIndex.includes('celebration-sunburst'), 'Compiled index.html should contain Sunburst styles');
    assert(compiledIndex.includes('celebration-shockwave'), 'Compiled index.html should contain Shockwave styles');
  });

  it('verifies ModalActionReport triggers Quest Clear animation upon report submission', () => {
    const modalScript = fs.readFileSync(path.join(__dirname, '../../src/scripts/ModalActionReport.html'), 'utf8');
    assert(modalScript.includes('CelebrationEffect.triggerQuestClear'), 'ModalActionReport should trigger CelebrationEffect when completed');
  });

  it('verifies ViewVisitorDetail triggers Quest Clear animation when action plan is completed', () => {
    const vdScript = fs.readFileSync(path.join(__dirname, '../../src/scripts/ViewVisitorDetail.html'), 'utf8');
    assert(vdScript.includes('CelebrationEffect.triggerQuestClear'), 'ViewVisitorDetail should trigger CelebrationEffect when toggled to complete');
  });
});
