<?php
/**
 * REvo OS - One-Tap iCalendar (.ics) Generator (api/event_ics.php)
 * 
 * Conforms to RFC 5545 specifications for seamless 1-tap addition
 * to iOS Calendar, Google Calendar, and Outlook.
 */

require_once __DIR__ . '/bootstrap.php';

use Api\Core\Database;

$type = $_GET['type'] ?? 'meeting';
$id = $_GET['id'] ?? '';
$date = $_GET['date'] ?? '';

$db = Database::getInstance();

$summary = 'BNI REvo イベント';
$description = 'BNI REvoチャプター公式イベント';
$location = 'Zoom オンライン';
$startDt = null;
$endDt = null;
$uid = 'revo_' . uniqid() . '@revo.k-d-o.biz';

// Helper to format iCal datetime in Asia/Tokyo
function formatIcalDateTime(string $dateTimeStr): string {
    $ts = strtotime($dateTimeStr);
    if (!$ts) {
        $ts = time();
    }
    return date('Ymd\THis', $ts);
}

// 1. Regular Meeting
if ($type === 'meeting') {
    $meetingDate = !empty($date) ? $date : (!empty($id) ? $id : date('Y-m-d', strtotime('next thursday')));
    
    // Check meeting customization
    $stmt = $db->prepare("SELECT * FROM meeting_customizations WHERE meeting_date = ?");
    $stmt->execute([$meetingDate]);
    $custom = $stmt->fetch(\PDO::FETCH_ASSOC);

    $title = $custom['title'] ?? '通常定例会';
    $summary = "【BNI REvo】定例会 ({$title})";
    
    $isOnline = isset($custom['is_online']) ? (int)$custom['is_online'] : 1;
    $location = $isOnline ? 'Zoom オンライン (https://us02web.zoom.us/j/REVO)' : ($custom['location_name'] ?? '通常定例会会場');

    $description = "BNI REvoチャプター 毎週木曜定例会\n" .
                   "■ メンバー集合: 06:00\n" .
                   "■ ビジター受付: 06:40\n" .
                   "■ 開会: 07:00 / 閉会: 08:30\n\n" .
                   "場所: {$location}\n" .
                   ($custom['notes'] ?? '');

    $startDt = "{$meetingDate} 06:00:00";
    $endDt = "{$meetingDate} 08:30:00";
    $uid = "revo_meeting_{$meetingDate}@revo.k-d-o.biz";
}
// 2. Chapter Event (BOD, 役員会, 懇親会, メンバーイベント)
elseif ($type === 'chapter_event') {
    $stmt = $db->prepare("SELECT * FROM chapter_events WHERE id = ?");
    $stmt->execute([$id]);
    $ev = $stmt->fetch(\PDO::FETCH_ASSOC);

    if ($ev) {
        $summary = "【REvo】{$ev['title']}";
        $isOnline = (int)($ev['is_online'] ?? 0);
        $location = $isOnline ? 'Zoom オンライン' : ($ev['location'] ?: '会場未定');
        $description = ($ev['description'] ?: $ev['title']) . "\n\n" .
                       (!empty($ev['organizer']) ? "主催: {$ev['organizer']}\n" : '') .
                       (!empty($ev['participants']) ? "参加対象: {$ev['participants']}\n" : '') .
                       (!empty($ev['flyer_url']) ? "チラシURL: {$ev['flyer_url']}\n" : '');
        $startDt = $ev['start_datetime'];
        $endDt = !empty($ev['end_datetime']) ? $ev['end_datetime'] : date('Y-m-d H:i:s', strtotime($startDt . ' +1 hour'));
        $uid = "revo_ch_event_{$ev['id']}@revo.k-d-o.biz";
    }
}
// 3. Region Event (Kyoto City Central Training)
elseif ($type === 'region_event') {
    $stmt = $db->prepare("SELECT * FROM region_events WHERE id = ?");
    $stmt->execute([$id]);
    $re = $stmt->fetch(\PDO::FETCH_ASSOC);

    if ($re) {
        $summary = "【BNI研修】{$re['title']}";
        $isOnline = (int)($re['is_online'] ?? 1);
        $location = $isOnline ? 'Zoom オンライン' : ($re['location_name'] ?: '京都CC指定会場');
        $description = "BNI 京都シティセントラル公式研修\n" .
                       "講師: " . ($re['trainer_name'] ?: '未定') . "\n" .
                       "受講料: " . ($re['fee'] ?: '無料') . "\n" .
                       "詳細/申込: " . ($re['register_url'] ?: 'https://bni-ck.com/ja/events');
        $startDt = $re['start_datetime'];
        $endDt = !empty($re['end_datetime']) ? $re['end_datetime'] : date('Y-m-d H:i:s', strtotime($startDt . ' +2 hours'));
        $uid = "revo_region_{$re['id']}@revo.k-d-o.biz";
    }
}

// Fallback dates
if (!$startDt) {
    $startDt = date('Y-m-d H:i:s');
    $endDt = date('Y-m-d H:i:s', strtotime('+1 hour'));
}

$dtStamp = date('Ymd\THis\Z');
$icalStart = formatIcalDateTime($startDt);
$icalEnd = formatIcalDateTime($endDt);

// Escape iCal text fields
function escapeIcalText(string $str): string {
    $str = str_replace('\\', '\\\\', $str);
    $str = str_replace(';', '\;', $str);
    $str = str_replace(',', '\,');
    $str = str_replace(["\r\n", "\n", "\r"], "\\n", $str);
    return $str;
}

$escapedSummary = escapeIcalText($summary);
$escapedDescription = escapeIcalText($description);
$escapedLocation = escapeIcalText($location);

$filename = 'revo_event_' . date('Ymd_His') . '.ics';

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache, no-store, must-revalidate');

echo "BEGIN:VCALENDAR\r\n";
echo "VERSION:2.0\r\n";
echo "PRODID:-//REvo OS//Visitor Host Revolution//JA\r\n";
echo "CALSCALE:GREGORIAN\r\n";
echo "METHOD:PUBLISH\r\n";
echo "X-WR-CALNAME:BNI REvo\r\n";
echo "X-WR-TIMEZONE:Asia/Tokyo\r\n";
echo "BEGIN:VEVENT\r\n";
echo "UID:{$uid}\r\n";
echo "DTSTAMP:{$dtStamp}\r\n";
echo "DTSTART;TZID=Asia/Tokyo:{$icalStart}\r\n";
echo "DTEND;TZID=Asia/Tokyo:{$icalEnd}\r\n";
echo "SUMMARY:{$escapedSummary}\r\n";
echo "DESCRIPTION:{$escapedDescription}\r\n";
echo "LOCATION:{$escapedLocation}\r\n";
echo "STATUS:CONFIRMED\r\n";
echo "END:VEVENT\r\n";
echo "END:VCALENDAR\r\n";
exit;
