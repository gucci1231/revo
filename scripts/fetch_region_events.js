/**
 * Node.js script: scripts/fetch_region_events.js
 * Synchronize BNI Kyoto City Central events locally into SQLite database.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const { execSync } = require('child_process');

const DB_FILE = path.join(__dirname, '../api/data/database.sqlite');
const REGION_ID = '7641';
const BASE_HOST = 'bni-ck.com';

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function fetchEventTypes() {
  const p = `/web/open/cmsViewEventTypesJson?regionIds=${REGION_ID}&request_locale=ja&siteLocale=ja`;
  const res = await httpRequest({
    host: BASE_HOST,
    path: p,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    timeout: 15000
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    try {
      const data = JSON.parse(res.body);
      const map = {};
      data.forEach(item => {
        if (item.typeID && item.typeName) {
          map[item.typeID] = item.typeName;
        }
      });
      return map;
    } catch(e) {
      return {};
    }
  }
  return {};
}

async function fetchCalendarEvents(startTimestamp, endTimestamp) {
  const p = `/web/open/cmsViewEventsCalendarJson?regionIds=${REGION_ID}&eventTypeId=0&cmsv3=true&start=${startTimestamp}&end=${endTimestamp}`;
  const res = await httpRequest({
    host: BASE_HOST,
    path: p,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    timeout: 15000
  });

  if (res.statusCode >= 200 && res.statusCode < 300) {
    try {
      return JSON.parse(res.body);
    } catch(e) {
      return [];
    }
  }
  return [];
}

async function fetchEventDetail(eventIdHash) {
  const decodedEventId = decodeURIComponent(eventIdHash);
  const mappedWidgetSettings = JSON.stringify([
    { key: 178, name: "Contact Person", value: "担当者" },
    { key: 179, name: "Cost for members:", value: "価格（BNIメンバー）:" },
    { key: 180, name: "Cost for non-members:", value: "価格（BNIメンバー以外）:" },
    { key: 181, name: "Max No of attendees:", value: "定員:" },
    { key: 182, name: "No of registrations:", value: "登録数:" },
    { key: 183, name: "Registration for members", value: "参加申込（BNIメンバー）" },
    { key: 184, name: "Registration for non-members", value: "参加申込（BNIメンバー以外）" },
    { key: 185, name: "to", value: "～" },
    { key: 186, name: "Location/Area", value: "開催地" },
    { key: 351, name: "Back", value: "戻る" }
  ]);

  const postBody = querystring.stringify({
    pageMode: 'Live_Site',
    'languages[activeLanguage][id]': '13',
    'languages[activeLanguage][localeCode]': 'ja',
    'languages[activeLanguage][descriptionKey]': 'Japanese',
    mappedWidgetSettings: mappedWidgetSettings,
    eventId: decodedEventId
  });

  const res = await httpRequest({
    host: BASE_HOST,
    path: '/bnicms/v3/frontend/eventdetail/display',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postBody),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    timeout: 15000
  }, postBody);

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return parseDetailHtml(res.body);
  }
  return {};
}

function parseDetailHtml(html) {
  const detail = {
    location_name: '',
    location_address: '',
    location_map_url: '',
    is_online: 0,
    cost_member: '',
    cost_non_member: '',
    contact_name: '',
    contact_phone: '',
    max_attendees: 0,
    num_registered: 0,
    registration_url: '',
    body_html: ''
  };

  if (/(オンライン|online|ZOOM|Zoom|zoom)/i.test(html)) {
    detail.is_online = 1;
  }

  const bodyMatch = html.match(/<div class="col-xs-12 col-sm-12 col-md-4">([\s\S]*?)<\/div>\s*<div class="col-xs-12 col-sm-6 col-md-4">/i);
  if (bodyMatch) {
    detail.body_html = bodyMatch[1].trim();
  }

  const contactMatch = html.match(/<h3>担当者<\/h3>[\s\S]*?<div class="rCol">\s*<p>([\s\S]*?)<\/p>/i);
  if (contactMatch) {
    const raw = contactMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      detail.contact_name = lines[0];
      for (const line of lines) {
        const pm = line.match(/Phone\s*No:\s*([0-9\-]+)/i);
        if (pm) detail.contact_phone = pm[1];
      }
    }
  }

  const memberCostMatch = html.match(/価格（BNIメンバー）:<\/span>\s*([^<]+)/);
  if (memberCostMatch) detail.cost_member = memberCostMatch[1].trim();

  const nonMemberCostMatch = html.match(/価格（BNIメンバー以外）:<\/span>\s*([^<]+)/);
  if (nonMemberCostMatch) detail.cost_non_member = nonMemberCostMatch[1].trim();

  const maxAttMatch = html.match(/定員:<\/span>\s*(\d+)/);
  if (maxAttMatch) detail.max_attendees = parseInt(maxAttMatch[1], 10);

  const regNumMatch = html.match(/登録数:<\/span>\s*(\d+)/);
  if (regNumMatch) detail.num_registered = parseInt(regNumMatch[1], 10);

  const locMatch = html.match(/<div class="box"><h3>開催地<\/h3>\s*<p class="address">([\s\S]*?)<\/p>/i);
  if (locMatch) {
    const addrRaw = locMatch[1];
    const mapM = addrRaw.match(/<a href=['"](https:\/\/[^'"]+)['"][^>]*vieweventlocation/i);
    if (mapM) detail.location_map_url = mapM[1];

    const clean = addrRaw.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      detail.location_name = lines[0];
      detail.location_address = lines.slice(1).join(' ');
    }
  }

  const regUrlMatch = html.match(/<a href=['"](https:\/\/www\.bniconnectglobal\.com\/web\/secure\/appsEventsViewEventDetails\?eventId=\d+)['"]/i);
  if (regUrlMatch) {
    detail.registration_url = regUrlMatch[1];
  }

  return detail;
}

function escapeSql(str) {
  if (str === null || str === undefined) return "''";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

async function run() {
  console.log('=== Starting BNI Kyoto City Central Events Sync ===');
  const now = Math.floor(Date.now() / 1000);
  const startTs = now - (30 * 86400); // 30 days back
  const endTs = now + (180 * 86400); // 180 days ahead

  console.log('Fetching event types...');
  const typesMap = await fetchEventTypes();
  console.log(`Found ${Object.keys(typesMap).length} event types.`);

  console.log('Fetching calendar events...');
  const events = await fetchCalendarEvents(startTs, endTs);
  console.log(`Found ${events.length} calendar events.`);

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const sqlStatements = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const eventId = parseInt(ev.id, 10);
    if (!eventId) continue;

    const title = (ev.title || '').trim();
    const desc = (ev.description || '').trim();
    const start = (ev.start || '').replace('T', ' ') + ':00';
    const end = (ev.end || '').replace('T', ' ') + ':00';
    const rawUrl = ev.url || '';

    let eventIdHash = '';
    const um = rawUrl.match(/eventId=([^&]+)/);
    if (um) eventIdHash = um[1];

    let eventTypeName = '';
    let eventTypeId = 0;
    for (const [tid, tname] of Object.entries(typesMap)) {
      if (title.includes(tname)) {
        eventTypeName = tname;
        eventTypeId = parseInt(tid, 10);
        break;
      }
    }

    let isOnline = 0;
    if (/(オンライン|online|ZOOM|Zoom|zoom)/i.test(title)) {
      isOnline = 1;
    }

    let details = {};
    if (eventIdHash && (i < 15 || new Date(start) >= new Date())) {
      try {
        details = await fetchEventDetail(eventIdHash);
        await new Promise(r => setTimeout(r, 80)); // 80ms throttle
      } catch(e) {
        // ignore
      }
    }

    const merged = {
      id: eventId,
      event_id_hash: eventIdHash,
      title: title,
      description: desc,
      event_type_id: eventTypeId,
      event_type_name: eventTypeName,
      start_datetime: start,
      end_datetime: end,
      location_name: details.location_name || '',
      location_address: details.location_address || '',
      location_map_url: details.location_map_url || '',
      is_online: details.is_online !== undefined ? details.is_online : isOnline,
      cost_member: details.cost_member || '',
      cost_non_member: details.cost_non_member || '',
      contact_name: details.contact_name || '',
      contact_phone: details.contact_phone || '',
      max_attendees: details.max_attendees || 0,
      num_registered: details.num_registered || 0,
      detail_url: `https://${BASE_HOST}/ja/${rawUrl}`,
      registration_url: details.registration_url || '',
      body_html: details.body_html || '',
      created_at: nowStr,
      updated_at: nowStr
    };

    sqlStatements.push(`
      INSERT INTO region_events (
        id, event_id_hash, title, description, event_type_id, event_type_name,
        start_datetime, end_datetime, location_name, location_address,
        location_map_url, is_online, cost_member, cost_non_member,
        contact_name, contact_phone, max_attendees, num_registered,
        detail_url, registration_url, body_html, created_at, updated_at
      ) VALUES (
        ${merged.id}, ${escapeSql(merged.event_id_hash)}, ${escapeSql(merged.title)}, ${escapeSql(merged.description)},
        ${merged.event_type_id}, ${escapeSql(merged.event_type_name)}, ${escapeSql(merged.start_datetime)}, ${escapeSql(merged.end_datetime)},
        ${escapeSql(merged.location_name)}, ${escapeSql(merged.location_address)}, ${escapeSql(merged.location_map_url)},
        ${merged.is_online}, ${escapeSql(merged.cost_member)}, ${escapeSql(merged.cost_non_member)},
        ${escapeSql(merged.contact_name)}, ${escapeSql(merged.contact_phone)}, ${merged.max_attendees}, ${merged.num_registered},
        ${escapeSql(merged.detail_url)}, ${escapeSql(merged.registration_url)}, ${escapeSql(merged.body_html)},
        ${escapeSql(merged.created_at)}, ${escapeSql(merged.updated_at)}
      )
      ON CONFLICT(id) DO UPDATE SET
        event_id_hash = excluded.event_id_hash,
        title = excluded.title,
        description = excluded.description,
        event_type_id = excluded.event_type_id,
        event_type_name = excluded.event_type_name,
        start_datetime = excluded.start_datetime,
        end_datetime = excluded.end_datetime,
        location_name = CASE WHEN excluded.location_name != '' THEN excluded.location_name ELSE region_events.location_name END,
        location_address = CASE WHEN excluded.location_address != '' THEN excluded.location_address ELSE region_events.location_address END,
        location_map_url = CASE WHEN excluded.location_map_url != '' THEN excluded.location_map_url ELSE region_events.location_map_url END,
        is_online = excluded.is_online,
        cost_member = CASE WHEN excluded.cost_member != '' THEN excluded.cost_member ELSE region_events.cost_member END,
        cost_non_member = CASE WHEN excluded.cost_non_member != '' THEN excluded.cost_non_member ELSE region_events.cost_non_member END,
        contact_name = CASE WHEN excluded.contact_name != '' THEN excluded.contact_name ELSE region_events.contact_name END,
        contact_phone = CASE WHEN excluded.contact_phone != '' THEN excluded.contact_phone ELSE region_events.contact_phone END,
        max_attendees = CASE WHEN excluded.max_attendees > 0 THEN excluded.max_attendees ELSE region_events.max_attendees END,
        num_registered = CASE WHEN excluded.num_registered > 0 THEN excluded.num_registered ELSE region_events.num_registered END,
        detail_url = excluded.detail_url,
        registration_url = CASE WHEN excluded.registration_url != '' THEN excluded.registration_url ELSE region_events.registration_url END,
        body_html = CASE WHEN excluded.body_html != '' THEN excluded.body_html ELSE region_events.body_html END,
        updated_at = excluded.updated_at;
    `);

    if ((i + 1) % 5 === 0 || i === events.length - 1) {
      console.log(`[${i + 1}/${events.length}] Prepared: ${title}`);
    }
  }

  sqlStatements.push(`
    INSERT INTO settings (key, value) VALUES ('last_events_synced_at', ${escapeSql(nowStr)})
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `);

  const tmpFile = path.join(__dirname, `../api/data/events_import_${Date.now()}.sql`);
  fs.writeFileSync(tmpFile, 'BEGIN TRANSACTION;\n' + sqlStatements.join('\n') + '\nCOMMIT;\n', 'utf8');

  console.log(`Executing SQL batch (${sqlStatements.length} statements)...`);
  execSync(`sqlite3 "${DB_FILE}" < "${tmpFile}"`);
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

  console.log(`\n🎉 Local Sync Completed! Total: ${events.length} events processed.`);
}

if (require.main === module) {
  run().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}

module.exports = { run, fetchEventTypes, fetchCalendarEvents, fetchEventDetail, parseDetailHtml };
