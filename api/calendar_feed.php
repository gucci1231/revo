<?php
/**
 * REvo OS - Webcal Auto-Sync Calendar Feed (api/calendar_feed.php)
 * 
 * Provides live iCalendar subscription feed (webcal:// protocol)
 * Compatible with Apple Calendar (iOS / macOS), Google Calendar, and Outlook.
 */

require_once __DIR__ . '/bootstrap.php';

use Api\Services\TokenService;
use Api\Core\Database;

$token = $_GET['k'] ?? $_GET['token'] ?? '';
$memberId = 0;
$member = null;

if (!empty($token)) {
    $payload = TokenService::verifyToken($token);
    if ($payload && isset($payload['m'])) {
        $memberId = (int)$payload['m'];
    }
}

$db = Database::getInstance();
if ($memberId > 0) {
    $stmt = $db->prepare("SELECT * FROM members WHERE id = ?");
    $stmt->execute([$memberId]);
    $member = $stmt->fetch(\PDO::FETCH_ASSOC);
}

function escapeIcal(string $str): string {
    $str = str_replace('\\', '\\\\', $str);
    $str = str_replace(';', '\;', $str);
    $str = str_replace(',', '\,');
    $str = str_replace(["\r\n", "\n", "\r"], "\\n", $str);
    return $str;
}

function formatDt(string $dateTimeStr): string {
    $ts = strtotime($dateTimeStr);
    return date('Ymd\THis', $ts ?: time());
}

$calName = 'BNI REvo カレンダー' . ($member ? " ({$member['name']})" : '');
$dtStamp = date('Ymd\THis\Z');

header('Content-Type: text/calendar; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo "BEGIN:VCALENDAR\r\n";
echo "VERSION:2.0\r\n";
echo "PRODID:-//REvo OS//Visitor Host Revolution//JA\r\n";
echo "CALSCALE:GREGORIAN\r\n";
echo "METHOD:PUBLISH\r\n";
echo "X-WR-CALNAME:" . escapeIcal($calName) . "\r\n";
echo "X-WR-TIMEZONE:Asia/Tokyo\r\n";

// 1. Regular Meetings for the next 12 Thursdays
$current = strtotime('thursday this week');
if ($current < time() - 86400) {
    $current = strtotime('+1 week', $current);
}

for ($i = 0; $i < 12; $i++) {
    $mDate = date('Y-m-d', $current);

    // Customization check
    $stmt = $db->prepare("SELECT * FROM meeting_customizations WHERE meeting_date = ?");
    $stmt->execute([$mDate]);
    $custom = $stmt->fetch(\PDO::FETCH_ASSOC);

    $title = $custom['title'] ?? '通常定例会';
    $isOnline = isset($custom['is_online']) ? (int)$custom['is_online'] : 1;
    $loc = $isOnline ? 'Zoom オンライン (https://us02web.zoom.us/j/REVO)' : ($custom['location_name'] ?? '通常定例会会場');

    $summary = escapeIcal("【REvo】定例会 ({$title})");
    $desc = escapeIcal("BNI REvoチャプター 毎週木曜定例会\\nメンバー集合: 06:00\\nビジター受付: 06:40\\n開会: 07:00 / 閉会: 08:30");
    $locEsc = escapeIcal($loc);
    $dtStart = date('Ymd\T060000', $current);
    $dtEnd = date('Ymd\T083000', $current);
    $uid = "revo_meeting_{$mDate}@revo.k-d-o.biz";

    echo "BEGIN:VEVENT\r\n";
    echo "UID:{$uid}\r\n";
    echo "DTSTAMP:{$dtStamp}\r\n";
    echo "DTSTART;TZID=Asia/Tokyo:{$dtStart}\r\n";
    echo "DTEND;TZID=Asia/Tokyo:{$dtEnd}\r\n";
    echo "SUMMARY:{$summary}\r\n";
    echo "DESCRIPTION:{$desc}\r\n";
    echo "LOCATION:{$locEsc}\r\n";
    echo "STATUS:CONFIRMED\r\n";
    echo "END:VEVENT\r\n";

    $current = strtotime('+1 week', $current);
}

// 2. Chapter Events (Future & Recent)
$stmt = $db->query("
    SELECT * FROM chapter_events 
    WHERE start_datetime >= date('now', '-7 days')
    ORDER BY start_datetime ASC 
    LIMIT 30
");
$events = $stmt->fetchAll(\PDO::FETCH_ASSOC);

foreach ($events as $ev) {
    $uid = "revo_ch_event_{$ev['id']}@revo.k-d-o.biz";
    $summary = escapeIcal("【REvo】{$ev['title']}");
    $desc = escapeIcal(($ev['description'] ?: $ev['title']) . ($ev['organizer'] ? "\\n主催: {$ev['organizer']}" : ''));
    $loc = escapeIcal($ev['location'] ?: 'オンライン');
    $dtStart = formatDt($ev['start_datetime']);
    $dtEnd = formatDt(!empty($ev['end_datetime']) ? $ev['end_datetime'] : date('Y-m-d H:i:s', strtotime($ev['start_datetime'] . ' +1 hour')));

    echo "BEGIN:VEVENT\r\n";
    echo "UID:{$uid}\r\n";
    echo "DTSTAMP:{$dtStamp}\r\n";
    echo "DTSTART;TZID=Asia/Tokyo:{$dtStart}\r\n";
    echo "DTEND;TZID=Asia/Tokyo:{$dtEnd}\r\n";
    echo "SUMMARY:{$summary}\r\n";
    echo "DESCRIPTION:{$desc}\r\n";
    echo "LOCATION:{$loc}\r\n";
    echo "STATUS:CONFIRMED\r\n";
    echo "END:VEVENT\r\n";
}

// 3. Member's Pending Action Plans (If authenticated)
if ($member) {
    $stmt = $db->prepare("
        SELECT ap.*, v.visitor_name 
        FROM action_plans ap
        LEFT JOIN visitors v ON ap.visitor_id = v.id
        WHERE (ap.assignee_name = ? OR ap.assignee_id = ?)
          AND ap.is_completed = 0
          AND ap.due_date >= date('now', '-3 days')
    ");
    $stmt->execute([$member['name'], (string)$member['id']]);
    $plans = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    foreach ($plans as $p) {
        $uid = "revo_action_{$p['id']}@revo.k-d-o.biz";
        $summary = escapeIcal("【締切】{$p['visitor_name']} 様フォロー: {$p['action_text']}");
        $desc = escapeIcal("ビジターフォロー期日: {$p['due_date']}\\n対象: {$p['visitor_name']} 様");
        $dtStart = date('Ymd\T090000', strtotime($p['due_date']));
        $dtEnd = date('Ymd\T100000', strtotime($p['due_date']));

        echo "BEGIN:VEVENT\r\n";
        echo "UID:{$uid}\r\n";
        echo "DTSTAMP:{$dtStamp}\r\n";
        echo "DTSTART;TZID=Asia/Tokyo:{$dtStart}\r\n";
        echo "DTEND;TZID=Asia/Tokyo:{$dtEnd}\r\n";
        echo "SUMMARY:{$summary}\r\n";
        echo "DESCRIPTION:{$desc}\r\n";
        echo "STATUS:CONFIRMED\r\n";
        echo "END:VEVENT\r\n";
    }
}

echo "END:VCALENDAR\r\n";
exit;
