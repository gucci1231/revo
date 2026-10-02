const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Chapter Links & REvo OS Navigation Feature Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

  it('verifies REvo OS branding and categorized navigation structure', () => {
    assert.strictEqual(indexHtml.includes('REvo OS'), true);
    assert.strictEqual(indexHtml.includes('BNI REvo Chapter OS'), true);
    assert.strictEqual(indexHtml.includes('drawer-section-title'), true);
    assert.strictEqual(indexHtml.includes('drawer-section-divider'), true);

    // Nav items
    assert.strictEqual(indexHtml.includes('id="drawer-item-dashboard"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-priority-follow"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-visitors"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-actions"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-links"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-palms-ranking"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-training"'), true);
    assert.strictEqual(indexHtml.includes('id="drawer-item-schedules"'), true);
  });

  it('verifies Chapter Links HTML elements exist in compiled index.html', () => {
    assert.strictEqual(indexHtml.includes('id="view-links"'), true);
    assert.strictEqual(indexHtml.includes('id="links-grid-container"'), true);
    assert.strictEqual(indexHtml.includes('id="links-category-filter"'), true);
    assert.strictEqual(indexHtml.includes('id="modal-link-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="form-link-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="link-field-title"'), true);
    assert.strictEqual(indexHtml.includes('id="link-field-url"'), true);
  });

  it('verifies Chapter Links JS functions and ApiService mappings exist', () => {
    assert.strictEqual(indexHtml.includes('function fetchChapterLinks'), true);
    assert.strictEqual(indexHtml.includes('function renderChapterLinks'), true);
    assert.strictEqual(indexHtml.includes('function openLinkModal'), true);
    assert.strictEqual(indexHtml.includes('function closeLinkModal'), true);
    assert.strictEqual(indexHtml.includes('function handleLinkSubmit'), true);
    assert.strictEqual(indexHtml.includes('function deleteChapterLink'), true);
    assert.strictEqual(indexHtml.includes('function filterLinksCategory'), true);

    // ApiService mappings
    assert.strictEqual(indexHtml.includes('getChapterLinksApi'), true);
    assert.strictEqual(indexHtml.includes('saveChapterLinkApi'), true);
    assert.strictEqual(indexHtml.includes('deleteChapterLinkApi'), true);
    assert.strictEqual(indexHtml.includes('/api/links.php?action=list'), true);
  });

  it('verifies backend LinkRepository and LinkController files exist', () => {
    const repoPath = path.join(rootDir, 'api/Repositories/LinkRepository.php');
    const controllerPath = path.join(rootDir, 'api/Controllers/LinkController.php');
    const entryPath = path.join(rootDir, 'api/links.php');

    assert.strictEqual(fs.existsSync(repoPath), true);
    assert.strictEqual(fs.existsSync(controllerPath), true);
    assert.strictEqual(fs.existsSync(entryPath), true);

    const repoContent = fs.readFileSync(repoPath, 'utf8');
    assert.strictEqual(repoContent.includes('class LinkRepository'), true);
    assert.strictEqual(repoContent.includes('chapter_links'), true);

    const controllerContent = fs.readFileSync(controllerPath, 'utf8');
    assert.strictEqual(controllerContent.includes('class LinkController'), true);
  });

  it('verifies Scope Segmented Control, Search Box, and Refined Categories in Chapter Links', () => {
    // HTML elements
    assert.strictEqual(indexHtml.includes('id="links-scope-tabs"'), true);
    assert.strictEqual(indexHtml.includes('id="links-search-input"'), true);
    assert.strictEqual(indexHtml.includes('id="links-count-badge"'), true);
    assert.strictEqual(indexHtml.includes('id="btn-clear-link-search"'), true);

    // JS functions
    assert.strictEqual(indexHtml.includes('function setLinkScope'), true);
    assert.strictEqual(indexHtml.includes('function handleLinkSearch'), true);
    assert.strictEqual(indexHtml.includes('function clearLinkSearch'), true);
    assert.strictEqual(indexHtml.includes('function renderCategoryPills'), true);

    // Categories in modal select
    assert.strictEqual(indexHtml.includes('value="日常・1to1"'), true);
    assert.strictEqual(indexHtml.includes('value="ビジター・入会"'), true);
    assert.strictEqual(indexHtml.includes('value="公式ポータル・学び"'), true);
    assert.strictEqual(indexHtml.includes('value="役員・チャプター運営"'), true);
    assert.strictEqual(indexHtml.includes('value="アーカイブ"'), true);
  });
});
