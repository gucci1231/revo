const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📅 Event & Training Comprehensive Calendar Feature Tests', () => {
  const rootDir = path.join(__dirname, '../..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const viewScript = fs.readFileSync(path.join(rootDir, 'src/scripts/ViewTraining.html'), 'utf8');
  const apiService = fs.readFileSync(path.join(rootDir, 'src/ApiService.html'), 'utf8');
  const databasePhp = fs.readFileSync(path.join(rootDir, 'api/Core/Database.php'), 'utf8');
  const eventRepoPhp = fs.readFileSync(path.join(rootDir, 'api/Repositories/EventRepository.php'), 'utf8');
  const devServerJs = fs.readFileSync(path.join(rootDir, 'dev-server.js'), 'utf8');

  it('verifies Calendar view container, month toolbar, and 7-day grid exist in index.html', () => {
    assert.ok(indexHtml.includes('id="calendar-view-container"'), 'Calendar view container exists');
    assert.ok(indexHtml.includes('id="calendar-month-toolbar"'), 'Calendar month toolbar exists');
    assert.ok(indexHtml.includes('id="calendar-grid"'), 'Calendar grid exists');
    assert.ok(indexHtml.includes('id="event-view-mode-tabs"'), 'View mode switcher (Calendar vs List) exists');
    assert.ok(indexHtml.includes('id="calendar-current-month-label"'), 'Current month label exists');
  });

  it('verifies Chapter Event Add/Edit Modal and its form elements exist in index.html', () => {
    assert.ok(indexHtml.includes('id="modal-chapter-event"'), 'Chapter event modal exists');
    assert.ok(indexHtml.includes('id="form-chapter-event"'), 'Chapter event form exists');
    assert.ok(indexHtml.includes('id="ch-ev-title"'), 'Title input exists');
    assert.ok(indexHtml.includes('id="ch-ev-category"'), 'Category select exists');
    assert.ok(indexHtml.includes('id="ch-ev-date"'), 'Date input exists');
    assert.ok(indexHtml.includes('id="ch-ev-start-time"'), 'Start time input exists');
    assert.ok(indexHtml.includes('id="ch-ev-end-time"'), 'End time input exists');
    assert.ok(indexHtml.includes('id="ch-ev-location"'), 'Location input exists');
    assert.ok(indexHtml.includes('id="btn-delete-chapter-event"'), 'Delete button exists');
  });

  it('verifies Day Schedule Timeline and Meeting Detail Modals exist in index.html', () => {
    assert.ok(indexHtml.includes('id="modal-day-events"'), 'Day events modal exists');
    assert.ok(indexHtml.includes('id="modal-day-title"'), 'Day title exists');
    assert.ok(indexHtml.includes('id="modal-day-events-list"'), 'Day events list exists');
    assert.ok(indexHtml.includes('id="modal-meeting-detail"'), 'Meeting detail modal exists');
    assert.ok(indexHtml.includes('id="modal-meeting-datetime"'), 'Meeting datetime display exists');
    assert.ok(indexHtml.includes('id="modal-meeting-visitor-count"'), 'Meeting visitor count display exists');
  });

  it('verifies Calendar & Chapter Event JS functions are defined in scripts', () => {
    assert.ok(viewScript.includes('function renderCalendarGrid()'), 'renderCalendarGrid defined');
    assert.ok(viewScript.includes('function navigateCalendarMonth('), 'navigateCalendarMonth defined');
    assert.ok(viewScript.includes('function jumpToCurrentMonth()'), 'jumpToCurrentMonth defined');
    assert.ok(viewScript.includes('function setEventViewMode('), 'setEventViewMode defined');
    assert.ok(viewScript.includes('function setEventSourceFilter('), 'setEventSourceFilter defined');
    assert.ok(viewScript.includes('function openChapterEventModal('), 'openChapterEventModal defined');
    assert.ok(viewScript.includes('function handleChapterEventSubmit('), 'handleChapterEventSubmit defined');
    assert.ok(viewScript.includes('function handleDeleteChapterEvent('), 'handleDeleteChapterEvent defined');
    assert.ok(viewScript.includes('function openDayEventsModal('), 'openDayEventsModal defined');
    assert.ok(viewScript.includes('function openMeetingDetailModal('), 'openMeetingDetailModal defined');
  });

  it('verifies ApiService routes for Calendar & Chapter Events', () => {
    assert.ok(apiService.includes("case 'getCalendarEventsApi':"), 'getCalendarEventsApi route exists');
    assert.ok(apiService.includes("case 'saveChapterEventApi':"), 'saveChapterEventApi route exists');
    assert.ok(apiService.includes("case 'deleteChapterEventApi':"), 'deleteChapterEventApi route exists');
    assert.ok(apiService.includes("case 'getChapterEventDetailApi':"), 'getChapterEventDetailApi route exists');
  });

  it('verifies Database.php includes chapter_events schema and seed function', () => {
    assert.ok(databasePhp.includes('CREATE TABLE IF NOT EXISTS chapter_events'), 'chapter_events table defined');
    assert.ok(databasePhp.includes('seedDefaultChapterEvents'), 'seedDefaultChapterEvents exists');
    assert.ok(databasePhp.includes('idx_chapter_events_start'), 'chapter_events start index exists');
  });

  it('verifies EventRepository.php implements calendar aggregation and chapter event CRUD', () => {
    assert.ok(eventRepoPhp.includes('public function getAllCalendarEvents('), 'getAllCalendarEvents defined');
    assert.ok(eventRepoPhp.includes('public function getChapterEvents('), 'getChapterEvents defined');
    assert.ok(eventRepoPhp.includes('public function saveChapterEvent('), 'saveChapterEvent defined');
    assert.ok(eventRepoPhp.includes('public function deleteChapterEvent('), 'deleteChapterEvent defined');
    assert.ok(eventRepoPhp.includes('public function getMeetingsForRange('), 'getMeetingsForRange defined');
  });

  it('verifies dev-server.js supports calendar and chapter_events actions', () => {
    assert.ok(devServerJs.includes("action === 'calendar'"), 'dev-server calendar action supported');
    assert.ok(devServerJs.includes("action === 'save_chapter_event'"), 'dev-server save_chapter_event supported');
    assert.ok(devServerJs.includes("action === 'delete_chapter_event'"), 'dev-server delete_chapter_event supported');
  });
});
