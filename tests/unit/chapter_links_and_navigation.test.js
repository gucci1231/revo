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
    assert.strictEqual(repoContent.includes('migrated_legacy_chapter_links_categories'), true);

    const dbPath = path.join(rootDir, 'api/Core/Database.php');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert.strictEqual(dbContent.includes('migrated_legacy_chapter_links_categories'), true);

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

  it('verifies safe escapeHtml usage and window.Utils namespace resilience', () => {
    // index.html should define window.Utils.escapeHtml
    assert.strictEqual(indexHtml.includes('window.Utils.escapeHtml = escapeHtml;'), true);

    // ViewLinks scripts should not have dangling undefined Utils.escapeHtml
    const viewLinksScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewLinks.html'), 'utf8');
    assert.strictEqual(viewLinksScript.includes('Utils.escapeHtml'), false);
  });

  it('verifies nested genre list view and domain badge helpers in Chapter Links', () => {
    assert.strictEqual(indexHtml.includes('LINK_CATEGORY_ORDER'), true);
    assert.strictEqual(indexHtml.includes('function toggleLinkGenre'), true);
    assert.strictEqual(indexHtml.includes('function getLinkDomainInfo'), true);
    assert.strictEqual(indexHtml.includes('linkGenreCollapsedMap'), true);
    assert.strictEqual(indexHtml.includes('genre-body-'), true);
  });

  it('verifies Drag & Drop reordering and Category CRUD UI elements and functions', () => {
    // Category CRUD Modal & Button
    assert.strictEqual(indexHtml.includes('id="btn-add-category"'), true);
    assert.strictEqual(indexHtml.includes('id="modal-category-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="form-category-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="category-field-name"'), true);
    assert.strictEqual(indexHtml.includes('function openCategoryModal'), true);
    assert.strictEqual(indexHtml.includes('function closeCategoryModal'), true);
    assert.strictEqual(indexHtml.includes('function handleCategorySubmit'), true);
    assert.strictEqual(indexHtml.includes('function deleteCategoryPrompt'), true);

    // Drag & Drop Handlers & UI classes
    assert.strictEqual(indexHtml.includes('function handleLinkDragStart'), true);
    assert.strictEqual(indexHtml.includes('function handleLinkDragOver'), true);
    assert.strictEqual(indexHtml.includes('function handleLinkDrop'), true);
    assert.strictEqual(indexHtml.includes('function handleCategoryDragStart'), true);
    assert.strictEqual(indexHtml.includes('function handleCategoryCardDrop'), true);
    assert.strictEqual(indexHtml.includes('function moveLinkQuick'), true);
    assert.strictEqual(indexHtml.includes('function moveCategoryQuick'), true);

    // ApiService Mappings
    assert.strictEqual(indexHtml.includes('reorderChapterLinksApi'), true);
    assert.strictEqual(indexHtml.includes('reorderChapterCategoriesApi'), true);
    assert.strictEqual(indexHtml.includes('saveChapterCategoryApi'), true);
    assert.strictEqual(indexHtml.includes('deleteChapterCategoryApi'), true);

    // Priority Categories
    assert.strictEqual(indexHtml.includes('ビジター情報'), true);
    assert.strictEqual(indexHtml.includes('メンバー情報'), true);
    assert.strictEqual(indexHtml.includes('アセット関連'), true);
  });

  it('verifies Scope Creation & Editing (Scope CRUD) and Dynamic Navigation Tabs', () => {
    // Scope UI elements
    assert.strictEqual(indexHtml.includes('id="btn-add-scope"'), true);
    assert.strictEqual(indexHtml.includes('id="modal-scope-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="form-scope-crud"'), true);
    assert.strictEqual(indexHtml.includes('id="scope-field-name"'), true);
    assert.strictEqual(indexHtml.includes('id="scope-field-key"'), true);

    // JS helper functions
    assert.strictEqual(indexHtml.includes('function openScopeModal'), true);
    assert.strictEqual(indexHtml.includes('function closeScopeModal'), true);
    assert.strictEqual(indexHtml.includes('function handleScopeSubmit'), true);
    assert.strictEqual(indexHtml.includes('function deleteScopePrompt'), true);
    assert.strictEqual(indexHtml.includes('function renderScopeTabs'), true);
    assert.strictEqual(indexHtml.includes('function renderCategoryScopeSelect'), true);

    // ApiService mappings
    assert.strictEqual(indexHtml.includes('saveChapterScopeApi'), true);
    assert.strictEqual(indexHtml.includes('deleteChapterScopeApi'), true);
  });

  it('verifies Database::delete method exists and deleteChapterLink handles single argument safely', () => {
    const dbPath = path.join(rootDir, 'api/Core/Database.php');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert.strictEqual(dbContent.includes('public function delete('), true);

    const viewLinksScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewLinks.html'), 'utf8');
    // Ensure delete button passes only linkId to avoid quoting/escaping bugs
    assert.strictEqual(/onclick="deleteChapterLink\('\${linkId}'\)"/.test(viewLinksScript), true);
  });

  it('verifies robust reorderChapterLinksApi and reorderChapterCategoriesApi payload packaging in ApiService', () => {
    const apiService = require(path.join(rootDir, 'public/js/services/apiService.js'));

    // 1. Direct array argument test (as called by ViewLinks)
    const linksConfig = apiService.getRestConfig('reorderChapterLinksApi', [{ id: 'LINK_001', sort_order: 10 }]);
    assert.strictEqual(linksConfig.url, '/api/links.php?action=reorder');
    assert.strictEqual(linksConfig.method, 'POST');
    assert.deepStrictEqual(linksConfig.body, { items: [{ id: 'LINK_001', sort_order: 10 }] });

    // 2. Object argument with items test
    const catConfig = apiService.getRestConfig('reorderChapterCategoriesApi', { items: [{ name: 'ビジター情報', sort_order: 10 }] });
    assert.strictEqual(catConfig.url, '/api/links.php?action=reorder_categories');
    assert.strictEqual(catConfig.method, 'POST');
    assert.deepStrictEqual(catConfig.body, { items: [{ name: 'ビジター情報', sort_order: 10 }] });
  });

  it('verifies Category Reorder sorting and rendering synchronization functions exist', () => {
    const viewLinksScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewLinks.html'), 'utf8');
    assert.strictEqual(viewLinksScript.includes('function applyCategoryReorder('), true);
    assert.strictEqual(viewLinksScript.includes('chapterCategoriesData.sort('), true);
    assert.strictEqual(viewLinksScript.includes('moveCategoryQuick('), true);
    assert.strictEqual(viewLinksScript.includes('handleCategoryCardDrop('), true);
  });

  it('verifies empty categories display, category modal list, and per-category link registration', () => {
    // 1. Category Modal list element exists
    assert.strictEqual(indexHtml.includes('id="category-modal-list"'), true);
    assert.strictEqual(indexHtml.includes('function renderModalCategoryList'), true);

    // 2. Empty category placeholder & per-category add button
    assert.strictEqual(indexHtml.includes('登録されているリンクはありません'), true);
    assert.strictEqual(indexHtml.includes('このカテゴリーにリンクを追加'), true);

    // 3. openLinkModal supports preselectedCategory argument
    const viewLinksScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewLinks.html'), 'utf8');
    assert.strictEqual(viewLinksScript.includes('function openLinkModal(linkId = null, preselectedCategory = null)'), true);

    // 4. Optgroup grouping in category select
    assert.strictEqual(viewLinksScript.includes('<optgroup label='), true);

    // 5. Category deletion protection for メンバー情報 and data-cat-name safety
    assert.strictEqual(viewLinksScript.includes('catName === \'メンバー情報\' || catName === \'CAT_MEMBER\''), true);
    assert.strictEqual(viewLinksScript.includes('data-cat-name='), true);
  });
});



