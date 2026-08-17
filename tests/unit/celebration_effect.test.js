const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Celebration Effect & Quest Clear Animation Unit Tests', () => {
  const effectHtml = fs.readFileSync(path.join(__dirname, '../../src/scripts/CelebrationEffect.html'), 'utf8');
  const compiledIndex = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

  it('verifies CelebrationEffect module methods and overlay structure', () => {
    assert(effectHtml.includes('window.CelebrationEffect'), 'CelebrationEffect should be attached to window');
    assert(effectHtml.includes('triggerQuestClear'), 'triggerQuestClear method should exist');
    assert(effectHtml.includes('playClearChime'), 'playClearChime method should exist');
    assert(effectHtml.includes('revo-quest-clear-overlay'), 'HUD overlay ID should be defined');
  });

  it('verifies CelebrationEffect is compiled into index.html', () => {
    assert(compiledIndex.includes('CelebrationEffect'), 'Compiled index.html should contain CelebrationEffect');
    assert(compiledIndex.includes('revo-quest-clear-overlay'), 'Compiled index.html should contain HUD template');
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
