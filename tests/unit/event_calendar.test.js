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

    // UI: ViewTraining script renders clean minimal icons for V:count, Zoom/In-person
    assert.ok(viewScript.includes("fa-users") && viewScript.includes("ev.visitor_count"), 'Timeline uses minimal users icon with visitor count');
    assert.ok(viewScript.includes("fa-video text-blue-500"), 'Timeline uses video icon for Zoom');
    assert.ok(viewScript.includes("fa-location-dot text-emerald-500"), 'Timeline uses location icon for In-person');

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

  it('verifies Deadline registration, category, and preset buttons exist', () => {
    // UI elements in index.html
    assert.ok(indexHtml.includes('value="締切・期限"'), '締切・期限 category option exists in index.html');
    assert.ok(indexHtml.includes('setDeadlinePreset('), 'setDeadlinePreset function calls exist in index.html');
    assert.ok(indexHtml.includes('ビジター出欠確認 締切'), '出欠締切 preset button exists in index.html');
    assert.ok(indexHtml.includes('推薦状・推薦文提出 締切'), '推薦状提出 preset button exists in index.html');
    assert.ok(indexHtml.includes('onclick="setEventSourceFilter(\'deadline\', this)"'), 'Deadline filter pill exists in index.html');

    // JS functions
    assert.ok(viewScript.includes('function setDeadlinePreset('), 'setDeadlinePreset defined in script');
    assert.ok(viewScript.includes('function onChapterEventCategoryChange()'), 'onChapterEventCategoryChange defined in script');
    assert.ok(viewScript.includes("isDeadline"), 'Script checks for deadline events');

    // Backend filtering
    assert.ok(eventRepoPhp.includes("$filters['source_type'] === 'deadline'"), 'EventRepository supports deadline filter');
    assert.ok(devServerJs.includes("sourceType === 'deadline'"), 'dev-server supports deadline filter');
  });

  it('verifies Visitor Action plan calendar aggregation, action detail modal, and creation tab exist', () => {
    // UI elements in index.html
    assert.ok(indexHtml.includes('id="modal-action-detail"'), 'Visitor action detail modal exists in index.html');
    assert.ok(indexHtml.includes('id="pane-visitor-action"'), 'Visitor action form tab pane exists in index.html');
    assert.ok(indexHtml.includes('id="tab-btn-visitor-action"'), 'Visitor action tab button exists in index.html');
    assert.ok(indexHtml.includes('id="cal-act-visitor-id"'), 'Visitor select exists in index.html');
    assert.ok(indexHtml.includes('id="cal-act-due-date"'), 'Due date input exists in index.html');
    assert.ok(indexHtml.includes('id="cal-act-type"'), 'Action type select exists in index.html');
    assert.ok(indexHtml.includes('id="btn-act-modal-toggle"'), 'Action toggle complete button exists in index.html');
    assert.ok(indexHtml.includes('onclick="setEventSourceFilter(\'action\', this)"'), 'Action filter pill exists in index.html');

    // JS functions
    assert.ok(viewScript.includes('function switchAddEventModalTab('), 'switchAddEventModalTab defined in script');
    assert.ok(viewScript.includes('function handleCalendarActionPlanSubmit('), 'handleCalendarActionPlanSubmit defined in script');
    assert.ok(viewScript.includes('function openActionDetailModal('), 'openActionDetailModal defined in script');
    assert.ok(viewScript.includes('function closeActionDetailModal('), 'closeActionDetailModal defined in script');
    assert.ok(viewScript.includes('function handleToggleActionFromModal('), 'handleToggleActionFromModal defined in script');
    assert.ok(viewScript.includes('function handleDeleteActionFromModal('), 'handleDeleteActionFromModal defined in script');
    assert.ok(viewScript.includes('function jumpToVisitorDetailFromModal('), 'jumpToVisitorDetailFromModal defined in script');

    // Backend: EventRepository.php & dev-server.js query action_plans
    assert.ok(eventRepoPhp.includes('SELECT ap.*,'), 'EventRepository queries action_plans for calendar');
    assert.ok(eventRepoPhp.includes("'source_type' => 'action'"), 'EventRepository tags action plans as source_type action');
    assert.ok(devServerJs.includes("SELECT ap.*"), 'dev-server queries action_plans for calendar');
    assert.ok(devServerJs.includes("source_type: 'action'"), 'dev-server tags action plans as source_type action');
  });

  it('verifies iPhone Calendar design: inline Day Agenda, mobile week strip, and single day timeline', () => {
    // UI elements in index.html
    assert.ok(indexHtml.includes('id="calendar-selected-day-agenda"'), 'Selected day inline agenda exists in index.html');

    // JS functions & indicators in viewScript
    assert.ok(viewScript.includes('function renderCalendarDayAgenda()'), 'renderCalendarDayAgenda is defined in script');
    assert.ok(viewScript.includes('function selectWeekDay('), 'selectWeekDay is defined in script');
    assert.ok(viewScript.includes('mobileWeekStripHtml'), 'Mobile week strip is rendered in week view');
    assert.ok(viewScript.includes('mobileDotsHtml'), 'Mobile color indicator dots are rendered in calendar cells');
    assert.ok(viewScript.includes('mobilePlacedEventsHtml'), 'Mobile single-day timeline is rendered in week view');
    assert.ok(viewScript.includes('bg-slate-900 text-white'), 'Selected date uses iPhone style solid circle highlight');
  });

  it('verifies robust Chapter Event Deletion, instant state removal, and seed protection', () => {
    // 1. Direct delete function defined in script
    assert.ok(viewScript.includes('function confirmDeleteChapterEventDirect('), 'confirmDeleteChapterEventDirect defined in script');
    assert.ok(viewScript.includes('allCalendarEvents.filter('), 'handleDeleteChapterEvent removes deleted event instantly from local state');

    // 2. ApiService includes cache: no-store and timestamp buster
    assert.ok(apiService.includes("cache: 'no-store'"), 'ApiService enforces cache: no-store on fetch requests');
    assert.ok(apiService.includes("params.append('_t'"), 'getCalendarEventsApi includes timestamp cache buster');

    // 3. Database prevents infinite re-seeding of deleted events
    assert.ok(databasePhp.includes('seeded_default_chapter_events'), 'Database.php records and checks seeded_default_chapter_events flag');
    assert.ok(databasePhp.includes('seeded_default_meeting_customizations'), 'Database.php records and checks seeded_default_meeting_customizations flag');

    // 4. Quick delete button exists in index.html
    assert.ok(indexHtml.includes('confirmDeleteChapterEventDirect'), 'Direct delete helper is wired into index.html');
  });

  it('verifies Member Event and Flyer Upload/Preview/Lightbox features across full stack', () => {
    const eventControllerPhp = fs.readFileSync(path.join(rootDir, 'api/Controllers/EventController.php'), 'utf8');

    // 1. UI Elements in index.html
    assert.ok(indexHtml.includes('id="btn-source-member"'), 'Member Event source filter button exists');
    assert.ok(indexHtml.includes('value="メンバーイベント"'), 'Member Event category option exists');
    assert.ok(indexHtml.includes('id="datalist-member-names"'), 'Member names datalist exists');
    assert.ok(indexHtml.includes('id="ch-ev-flyer-url"'), 'Flyer URL input exists');
    assert.ok(indexHtml.includes('id="ch-ev-flyer-file"'), 'Flyer file input exists');
    assert.ok(indexHtml.includes('id="ch-ev-flyer-preview-box"'), 'Flyer preview container exists');
    assert.ok(indexHtml.includes('id="modal-flyer-lightbox"'), 'Flyer Lightbox modal exists in index.html');

    // 2. JS Functions in viewScript
    assert.ok(viewScript.includes('function openFlyerLightbox('), 'openFlyerLightbox defined in script');
    assert.ok(viewScript.includes('function closeFlyerLightbox()'), 'closeFlyerLightbox defined in script');
    assert.ok(viewScript.includes('function uploadFlyerFile('), 'uploadFlyerFile defined in script');
    assert.ok(viewScript.includes('function setFlyerPreview('), 'setFlyerPreview defined in script');
    assert.ok(viewScript.includes('function removeCurrentFlyer('), 'removeCurrentFlyer defined in script');
    assert.ok(viewScript.includes('function populateMemberNamesDatalist()'), 'populateMemberNamesDatalist defined in script');

    // 3. Database & Backend Schemas
    assert.ok(databasePhp.includes('flyer_url'), 'Database.php includes flyer_url column and migration');
    assert.ok(devServerJs.includes('flyer_url'), 'dev-server.js includes flyer_url column and migration');

    // 4. Repositories & Controllers
    assert.ok(eventRepoPhp.includes('flyer_url'), 'EventRepository saves flyer_url');
    assert.ok(eventRepoPhp.includes("? 'member' : 'chapter'"), 'EventRepository tags member events as source_type member');
    assert.ok(eventControllerPhp.includes('function uploadFlyer()'), 'EventController implements uploadFlyer endpoint');
    assert.ok(devServerJs.includes("action === 'upload_flyer'"), 'dev-server supports upload_flyer action');
    assert.ok(apiService.includes("case 'uploadFlyerApi':"), 'ApiService maps uploadFlyerApi');

    // 5. Share text & styling
    assert.ok(viewScript.includes('■ チラシ・告知画像:'), 'Share text includes flyer URL');
  });

  it('verifies Chapter Event Info Detail Modal, mobile week swipe, and radical minimalism', () => {
    // 1. Chapter Event Detail Info Modal exists in index.html
    assert.ok(indexHtml.includes('id="modal-chapter-event-detail"'), 'Chapter event info detail modal exists');
    assert.ok(indexHtml.includes('id="ch-detail-title"'), 'Detail modal title exists');
    assert.ok(indexHtml.includes('id="ch-detail-datetime"'), 'Detail modal datetime exists');
    assert.ok(indexHtml.includes('id="btn-open-edit-from-detail"'), 'Edit button from detail modal exists');
    assert.ok(indexHtml.includes('id="btn-share-chapter-detail"'), 'Share button from detail modal exists');

    // 2. JS Functions for Info Detail Modal
    assert.ok(viewScript.includes('function openChapterEventDetailModal('), 'openChapterEventDetailModal is defined');
    assert.ok(viewScript.includes('function closeChapterEventDetailModal()'), 'closeChapterEventDetailModal is defined');
    assert.ok(viewScript.includes('function openEditFromChapterDetail()'), 'openEditFromChapterDetail is defined');
    assert.ok(viewScript.includes('openChapterEventDetailModal(ev);'), 'Event click opens detail modal instead of edit form');

    // 3. Touch Swipe and Mobile Week Navigation
    assert.ok(viewScript.includes('function initCalendarTouchSwipe()'), 'initCalendarTouchSwipe is defined');
    assert.ok(viewScript.includes('currentEventViewMode = \'week\';'), 'Mobile defaults to week view');

    // 4. Radical Minimalism: 4 KPI Cards hidden on mobile, color legend removed
    assert.ok(indexHtml.includes('hidden md:grid grid-cols-2 lg:grid-cols-4'), 'KPI cards are hidden on mobile');
    assert.ok(!indexHtml.includes('Color Legend (Apple Style Dots)'), 'Color legend is completely removed');
  });

  it('verifies Apple minimalist 1-button view cycle, icon add button, and filter popup modal', () => {
    // 1. Navigation header controls (1-button view toggle, filter trigger, and icon add button)
    assert.ok(indexHtml.includes('id="btn-view-mode-cycle"'), 'Single view mode switcher button exists');
    assert.ok(indexHtml.includes('id="btn-calendar-filter-open"'), 'Filter and search popup trigger button exists');
    assert.ok(indexHtml.includes('id="btn-calendar-add-event"'), 'Icon-only add event button exists');
    assert.ok(indexHtml.includes('id="calendar-filter-badge-dot"'), 'Filter indicator dot exists');

    // 2. Filter & Search Popup Modal
    assert.ok(indexHtml.includes('id="modal-calendar-filters"'), 'Filter popup modal exists in index.html');
    assert.ok(indexHtml.includes('id="training-search-input"'), 'Search input exists inside popup modal');
    assert.ok(indexHtml.includes('id="training-format-filters"'), 'Format filters exist inside popup modal');
    assert.ok(indexHtml.includes('id="event-source-filters"'), 'Source category filters exist inside popup modal');

    // 3. Script Functions
    assert.ok(viewScript.includes('function cycleEventViewMode()'), 'cycleEventViewMode is defined in script');
    assert.ok(viewScript.includes('function openCalendarFilterModal()'), 'openCalendarFilterModal is defined in script');
    assert.ok(viewScript.includes('function closeCalendarFilterModal()'), 'closeCalendarFilterModal is defined in script');
    assert.ok(viewScript.includes('function updateCalendarFilterIndicator()'), 'updateCalendarFilterIndicator is defined in script');
    assert.ok(viewScript.includes('function resetCalendarFilters()'), 'resetCalendarFilters is defined in script');
  });
});



