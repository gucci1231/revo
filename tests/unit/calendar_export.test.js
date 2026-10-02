const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('📅 Step 6-5: One-Tap Calendar Integration (.ics & Webcal) Feature Tests', () => {
  const eventIcsPhp = fs.readFileSync(path.join(__dirname, '../../api/event_ics.php'), 'utf8');
  const calendarFeedPhp = fs.readFileSync(path.join(__dirname, '../../api/calendar_feed.php'), 'utf8');

  it('verifies event_ics.php generates valid RFC 5545 iCalendar data', () => {
    assert.ok(eventIcsPhp.includes('Content-Type: text/calendar'), 'Must set text/calendar content type');
    assert.ok(eventIcsPhp.includes('BEGIN:VCALENDAR'), 'Must begin VCALENDAR block');
    assert.ok(eventIcsPhp.includes('VERSION:2.0'), 'Must specify iCal version 2.0');
    assert.ok(eventIcsPhp.includes('BEGIN:VEVENT'), 'Must begin VEVENT block');
    assert.ok(eventIcsPhp.includes('DTSTART;TZID=Asia/Tokyo:'), 'Must format start date with Asia/Tokyo timezone');
    assert.ok(eventIcsPhp.includes('escapeIcalText'), 'Must escape iCal text fields');
  });

  it('verifies event_ics.php supports regular meetings, chapter events, and region events', () => {
    assert.ok(eventIcsPhp.includes("type === 'meeting'"), 'Must handle regular meeting type');
    assert.ok(eventIcsPhp.includes("type === 'chapter_event'"), 'Must handle chapter event type');
    assert.ok(eventIcsPhp.includes("type === 'region_event'"), 'Must handle region event type');
    assert.ok(eventIcsPhp.includes('06:00'), 'Regular meeting start time must be 06:00');
    assert.ok(eventIcsPhp.includes('08:30'), 'Regular meeting end time must be 08:30');
  });

  it('verifies calendar_feed.php provides live Webcal subscription feed', () => {
    assert.ok(calendarFeedPhp.includes('BEGIN:VCALENDAR'), 'Must begin VCALENDAR block');
    assert.ok(calendarFeedPhp.includes('X-WR-CALNAME:'), 'Must provide calendar name header');
    assert.ok(calendarFeedPhp.includes('X-WR-TIMEZONE:Asia/Tokyo'), 'Must declare Asia/Tokyo timezone');
    assert.ok(calendarFeedPhp.includes('meeting_customizations'), 'Must respect meeting customizations');
    assert.ok(calendarFeedPhp.includes('chapter_events'), 'Must query chapter events');
    assert.ok(calendarFeedPhp.includes('action_plans'), 'Must query pending action plans when member authenticated');
  });
});
