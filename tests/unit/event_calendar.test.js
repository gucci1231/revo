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
    assert.ok(viewScript.includes('function renderWeekView()'), 'renderWeekView defined');
    assert.ok(viewScript.includes('function navigateCalendarWeek('), 'navigateCalendarWeek defined');
    assert.ok(viewScript.includes('function jumpToCurrentWeek()'), 'jumpToCurrentWeek defined');
  });

  it('verifies Weekly Calendar view container, week tabs, and week grid exist in index.html', () => {
    assert.ok(indexHtml.includes('id="week-view-container"'), 'Week view container exists');
    assert.ok(indexHtml.includes('id="week-grid"'), 'Week grid exists');
    assert.ok(indexHtml.includes('id="btn-view-mode-week"'), 'Week view mode button exists');
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

  it('verifies recurring event registration (weekdays/daily/weekly/biweekly) UI and logic', () => {
    assert.ok(indexHtml.includes('id="ch-ev-repeat-section"'), 'Repeat section exists in index.html');
    assert.ok(indexHtml.includes('id="ch-ev-repeat-type"'), 'Repeat type select exists in index.html');
    assert.ok(indexHtml.includes('value="weekdays"'), 'Weekdays option exists in repeat select');
    assert.ok(indexHtml.includes('id="ch-ev-repeat-until"'), 'Repeat until date input exists in index.html');
    assert.ok(indexHtml.includes('id="ch-ev-repeat-count"'), 'Repeat count select exists in index.html');
    assert.ok(indexHtml.includes('id="btn-delete-chapter-series"'), 'Delete series button exists in index.html');
    assert.ok(viewScript.includes('function onChapterEventRepeatTypeChange()'), 'onChapterEventRepeatTypeChange defined');
    assert.ok(viewScript.includes('function updateChapterEventRepeatSummary()'), 'updateChapterEventRepeatSummary defined');
    assert.ok(viewScript.includes("repeatType === 'weekdays'"), 'viewScript handles weekdays recurrence');
    assert.ok(eventRepoPhp.includes('recurrence_group_id'), 'EventRepository supports recurrence_group_id');
    assert.ok(eventRepoPhp.includes('recurrence_rule'), 'EventRepository supports recurrence_rule');
    assert.ok(eventRepoPhp.includes("'weekdays'"), 'EventRepository supports weekdays recurrence');
    assert.ok(devServerJs.includes('recurrence_group_id'), 'dev-server supports recurrence_group_id');
    assert.ok(devServerJs.includes("'weekdays'"), 'dev-server supports weekdays recurrence');
  });

  it('verifies Meeting Customization Edit Modal, presets, and API routes exist', () => {
    assert.ok(indexHtml.includes('id="modal-meeting-edit"'), 'Meeting edit modal exists in index.html');
    assert.ok(indexHtml.includes('id="form-meeting-edit"'), 'Meeting edit form exists in index.html');
    assert.ok(indexHtml.includes('id="mt-edit-title"'), 'Meeting title input exists in index.html');
    assert.ok(indexHtml.includes('id="mt-edit-category"'), 'Meeting category select exists in index.html');
    assert.ok(indexHtml.includes('id="mt-edit-is-online"'), 'Meeting is_online select exists in index.html');
    assert.ok(indexHtml.includes('id="mt-edit-location"'), 'Meeting location input exists in index.html');
    assert.ok(indexHtml.includes('id="btn-reset-meeting"'), 'Reset meeting button exists in index.html');
    assert.ok(indexHtml.includes('id="btn-open-edit-meeting"'), 'Open edit meeting button exists in index.html');

    assert.ok(viewScript.includes('function openMeetingEditModal('), 'openMeetingEditModal defined');
    assert.ok(viewScript.includes('function handleMeetingEditSubmit('), 'handleMeetingEditSubmit defined');
    assert.ok(viewScript.includes('function handleMeetingReset('), 'handleMeetingReset defined');
    assert.ok(viewScript.includes('function setMeetingTitlePreset('), 'setMeetingTitlePreset defined');

    assert.ok(apiService.includes("case 'saveMeetingCustomizationApi':"), 'saveMeetingCustomizationApi route exists in ApiService');
    assert.ok(apiService.includes("case 'resetMeetingCustomizationApi':"), 'resetMeetingCustomizationApi route exists in ApiService');

    assert.ok(databasePhp.includes('CREATE TABLE IF NOT EXISTS meeting_customizations'), 'meeting_customizations table defined in Database.php');
    assert.ok(databasePhp.includes('seedDefaultMeetingCustomizations'), 'seedDefaultMeetingCustomizations exists in Database.php');
    assert.ok(eventRepoPhp.includes('public function saveMeetingCustomization('), 'saveMeetingCustomization defined in EventRepository');
    assert.ok(eventRepoPhp.includes('public function resetMeetingCustomization('), 'resetMeetingCustomization defined in EventRepository');
    assert.ok(devServerJs.includes("action === 'save_meeting_customization'"), 'dev-server supports save_meeting_customization');
    assert.ok(devServerJs.includes("action === 'reset_meeting_customization'"), 'dev-server supports reset_meeting_customization');
  });

  it('verifies Apple Calendar style week timeline view and unified font sizes', () => {
    assert.ok(viewScript.includes('HOUR_HEIGHT'), 'Week view defines time slot height');
    assert.ok(viewScript.includes('START_HOUR'), 'Week view defines timeline start hour');
    assert.ok(viewScript.includes('END_HOUR'), 'Week view defines timeline end hour');
    assert.ok(viewScript.includes('font-mono font-bold text-xs tabular-nums'), 'Week view uses text-xs for event time');
    assert.ok(viewScript.includes('font-bold text-xs text-slate-900'), 'Week view uses text-xs for event title');
  });

  it('verifies Meeting Detail Modal renders visitor list with visitors array and links', () => {
    assert.ok(viewScript.includes('function renderMeetingModalVisitors('), 'renderMeetingModalVisitors is defined');
    assert.ok(viewScript.includes('function navigateToVisitorFromMeeting('), 'navigateToVisitorFromMeeting is defined');
    assert.ok(eventRepoPhp.includes("'visitors' => $dayVisitors"), 'EventRepository provides visitors array in meeting');
    assert.ok(devServerJs.includes('visitors: dayVisitors'), 'dev-server provides visitors array in meeting');
  });

  it('verifies Event Share Modal, share buttons, and helper functions exist', () => {
    // Modal & UI Elements
    assert.ok(indexHtml.includes('id="modal-event-share"'), 'Event share modal exists in index.html');
    assert.ok(indexHtml.includes('id="btn-share-line"'), 'LINE share button exists');
    assert.ok(indexHtml.includes('id="btn-share-copy-text"'), 'Copy share text button exists');
    assert.ok(indexHtml.includes('id="btn-share-gcal"'), 'Google Calendar add button exists');
    assert.ok(indexHtml.includes('id="btn-share-native"'), 'Native share or URL copy button exists');
    assert.ok(indexHtml.includes('id="share-modal-preview-text"'), 'Share text preview textarea exists');
    assert.ok(indexHtml.includes('id="btn-share-meeting-detail"'), 'Share button in meeting detail modal exists');
    assert.ok(indexHtml.includes('id="btn-share-training-detail"'), 'Share button in training detail modal exists');
    assert.ok(indexHtml.includes('id="btn-share-chapter-event"'), 'Share button in chapter event modal exists');

    // JS Functions
    assert.ok(viewScript.includes('function openEventShareModal('), 'openEventShareModal is defined');
    assert.ok(viewScript.includes('function closeEventShareModal('), 'closeEventShareModal is defined');
    assert.ok(viewScript.includes('function buildEventShareText('), 'buildEventShareText is defined');
    assert.ok(viewScript.includes('function getGoogleCalendarUrl('), 'getGoogleCalendarUrl is defined');
    assert.ok(viewScript.includes('function copyEventShareFullText('), 'copyEventShareFullText is defined');
    assert.ok(viewScript.includes('function handleNativeShareOrUrlCopy('), 'handleNativeShareOrUrlCopy is defined');
    assert.ok(viewScript.includes('function checkUrlEventDeepLink('), 'checkUrlEventDeepLink is defined');
    assert.ok(viewScript.includes('function getEventDeepLink('), 'getEventDeepLink is defined');
  });

  it('verifies Regular Meeting defaults to Zoom (online) and badges are compact and minimal', () => {
    // Backend: EventRepository.php and dev-server.js default is_online to 1 (Zoom)
    assert.ok(eventRepoPhp.includes("'is_online' => $custom ? (int)$custom['is_online'] : 1"), 'EventRepository defaults meeting is_online to 1');
    assert.ok(eventRepoPhp.includes("'location_name' => $custom ? ($custom['location_name'] ?? 'Zoom') : 'Zoom'"), 'EventRepository defaults location_name to Zoom');
    assert.ok(devServerJs.includes("is_online: custom ? (custom.is_online ? 1 : 0) : 1"), 'dev-server defaults meeting is_online to 1');

    // UI: ViewTraining script renders compact tags for V:count, Zoom/In-person
    assert.ok(viewScript.includes("text-[9px] font-extrabold text-blue-700 bg-blue-100/80 px-1 py-0 rounded shrink-0 leading-none"), 'Timeline uses compact V:count badge');
    assert.ok(viewScript.includes("text-[9px] font-bold text-blue-600 bg-blue-100/70 px-1 py-0 rounded shrink-0 leading-none"), 'Timeline uses compact Zoom badge');
    assert.ok(viewScript.includes("text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1 py-0 rounded shrink-0 leading-none"), 'Timeline uses compact In-person badge');

    // Month view pill V:count
    assert.ok(viewScript.includes("text-[9px] font-extrabold bg-blue-600 text-white shrink-0 leading-none"), 'Month view pill uses compact V:count badge');

    // Meeting detail modal badges
    assert.ok(indexHtml.includes('id="modal-meeting-online-badge"'), 'Meeting online badge exists in index.html');
    assert.ok(viewScript.includes("onlineBadge.innerText = 'Zoom';"), 'Meeting modal labels online meeting as Zoom');
    assert.ok(viewScript.includes("onlineBadge.innerText = '対面・会場';"), 'Meeting modal labels inperson meeting as 対面・会場');

    // Meeting edit preset buttons
    assert.ok(indexHtml.includes("setMeetingTitlePreset('REvoチャプター 定例会', '定例会', 1, 'Zoom')"), 'Preset for regular meeting uses Zoom (1)');
    assert.ok(indexHtml.includes("setMeetingTitlePreset('モメンタム', 'モメンタム', 1, 'Zoom')"), 'Preset for momentum uses Zoom (1)');
    assert.ok(indexHtml.includes("setMeetingTitlePreset('BOD 対面', 'ビジネスオープンデー', 0, 'スター食堂')"), 'Preset for BOD in-person uses in-person (0)');
  });

  it('verifies Regular Meeting times: Member 6:00, Visitor 6:40, Opening 7:00', () => {
    // Backend defaults start_datetime to 06:00:00
    assert.ok(eventRepoPhp.includes("($dateStr . ' 06:00:00')"), 'EventRepository defaults start_datetime to 06:00');
    assert.ok(devServerJs.includes("(dateStr + ' 06:00:00')"), 'dev-server defaults start_datetime to 06:00');

    // UI displays Member 6:00 and Visitor 6:40
    assert.ok(indexHtml.includes('07:00 開会 (メンバー 6:00 / ビジター 6:40)'), 'KPI card displays Member 6:00 and Visitor 6:40');
    assert.ok(indexHtml.includes('メンバー 06:00 / ビジター 06:40 受付 (07:00 開会)'), 'Meeting detail modal displays Member 06:00 / Visitor 06:40 reception');
    assert.ok(indexHtml.includes('id="mt-edit-start-time" value="06:00"'), 'Meeting edit form defaults start time to 06:00');
    assert.ok(viewScript.includes("■ 受付時間: メンバー 06:00〜 / ビジター 06:40〜 (07:00開会 / 08:30閉会)"), 'Share text includes reception time breakdown for meeting');
  });
});



