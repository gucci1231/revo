<?php
require_once __DIR__ . '/db.php';

// Fetch all visitors with their status and hearing sheet data
$stmt = $pdo->query("
    SELECT 
        v.id, 
        COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name, 
        COALESCE(v.furigana, '') as furigana, 
        COALESCE(v.company, '') as company, 
        COALESCE(v.profession, '') as profession, 
        COALESCE(v.inviter, '') as inviter, 
        COALESCE(v.event_date, '') as eventDate,
        COALESCE(v.attendance_count, '初めて') as attendanceCount,
        COALESCE(s.is_attended, '未') as isAttended,
        COALESCE(s.is_joined, '未') as isJoined,
        COALESCE(s.is_1to1, '未') as is1to1,
        COALESCE(s.is_matched, '未') as matching,
        COALESCE(h.feel_abc, '') as feelAbc,
        COALESCE(h.q7, '') as q7,
        COALESCE(h.orient_user, '') as orientUser,
        COALESCE(h.orient_memo, '') as orientMemo,
        COALESCE(h.follow_memo, '') as followMemo,
        CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet
    FROM visitors v
    LEFT JOIN visitors_status s ON v.id = s.visitor_id
    LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
    ORDER BY v.event_date DESC, v.id DESC
");
$visitors = $stmt->fetchAll();

// Fetch start_date setting from parameter or DB
$startDateStr = $_GET['start_date'] ?? $_POST['start_date'] ?? '';
if (!$startDateStr) {
    try {
        $stmtSet = $pdo->prepare("SELECT value FROM settings WHERE key = 'start_date'");
        $stmtSet->execute();
        $startDateStr = $stmtSet->fetchColumn() ?: '';
    } catch (Exception $e) {}
}
if (!$startDateStr) {
    $startDateStr = '2026/04/01';
}

$startDateTs = strtotime(str_replace('/', '-', $startDateStr));
if (!$startDateTs) {
    $startDateTs = strtotime('2026-04-01');
    $startDateStr = '2026/04/01';
}

$totalApplyCount = 0;
$totalJoinedCount = 0;
$totalAttendedCount = 0;
$totalHearingCount = 0;
$hotVisitors = [];

function getNextThursday($offsetWeeks = 0) {
    $ts = time();
    $dayOfWeek = date('w', $ts);
    $daysUntilThu = (4 - $dayOfWeek + 7) % 7;
    if ($daysUntilThu === 0 && date('H') >= 12) {
        $daysUntilThu = 7;
    }
    $targetTs = strtotime("+{$daysUntilThu} days", $ts);
    if ($offsetWeeks > 0) {
        $targetTs = strtotime("+{$offsetWeeks} weeks", $targetTs);
    }
    return date('Y/m/d', $targetTs);
}

function getPreviousThursday() {
    $ts = time();
    $dayOfWeek = date('w', $ts);
    $daysSinceThu = ($dayOfWeek - 4 + 7) % 7;
    if ($daysSinceThu === 0) $daysSinceThu = 7;
    return date('Y/m/d', strtotime("-{$daysSinceThu} days", $ts));
}

$nextThuFull = getNextThursday(0);
$afterNextThuFull = getNextThursday(1);
$lastThuFull = getPreviousThursday();

$nextThuStr = date('m/d', strtotime(str_replace('/', '-', $nextThuFull)));
$afterNextThuStr = date('m/d', strtotime(str_replace('/', '-', $afterNextThuFull)));
$lastThuStr = date('m/d', strtotime(str_replace('/', '-', $lastThuFull)));

$nextMeetingVisitors = [];
$lastMeetingVisitors = [];
$oneMonthFollowupVisitors = [];

$weeklyMap = [];
$monthlyMap = [];

$oneMonthAgoTs = strtotime('-30 days');

foreach ($visitors as $r) {
    $eDate = trim($r['eventDate']);
    $eTs = strtotime(str_replace('/', '-', $eDate));

    // Filter visitors by start_date (BNI term period)
    if ($eTs && $eTs < $startDateTs) {
        continue;
    }

    $isJoinedBool = ($r['isJoined'] === '入会済' || $r['isJoined'] === '済' || $r['isJoined'] === '入会');
    $isAttendedBool = ($r['isAttended'] === '参加' || $r['isAttended'] === '済');

    $totalApplyCount++;
    if ($isJoinedBool) $totalJoinedCount++;
    if ($isAttendedBool) $totalAttendedCount++;
    if ($r['hasHearingSheet']) $totalHearingCount++;

    $feel = strtoupper(trim($r['feelAbc']));
    if ($feel === 'A' && !$isJoinedBool) {
        $hotVisitors[] = $r;
    }

    if ($eDate === $nextThuFull || strpos($eDate, $nextThuStr) !== false) {
        $nextMeetingVisitors[] = $r;
    } else if ($eDate === $lastThuFull || strpos($eDate, $lastThuStr) !== false) {
        $lastMeetingVisitors[] = $r;
    }

    if ($eTs && $eTs >= $oneMonthAgoTs && !$isJoinedBool) {
        $oneMonthFollowupVisitors[] = $r;
    }

    if ($eDate !== '') {
        if (!isset($weeklyMap[$eDate])) {
            $weeklyMap[$eDate] = ['date' => $eDate, 'applyCount' => 0, 'attendedCount' => 0, 'joinedCount' => 0];
        }
        $weeklyMap[$eDate]['applyCount']++;
        if ($isAttendedBool) $weeklyMap[$eDate]['attendedCount']++;
        if ($isJoinedBool) $weeklyMap[$eDate]['joinedCount']++;

        $monthKey = substr($eDate, 0, 7);
        if (preg_match('/^\d{4}[\/\-]\d{2}$/', $monthKey)) {
            if (!isset($monthlyMap[$monthKey])) {
                $monthlyMap[$monthKey] = ['month' => $monthKey, 'applyCount' => 0, 'attendedCount' => 0, 'joinedCount' => 0];
            }
            $monthlyMap[$monthKey]['applyCount']++;
            if ($isAttendedBool) $monthlyMap[$monthKey]['attendedCount']++;
            if ($isJoinedBool) $monthlyMap[$monthKey]['joinedCount']++;
        }
    }
}

krsort($weeklyMap);
$weeklyStats = array_values($weeklyMap);

krsort($monthlyMap);
$monthlyStats = [];
foreach ($monthlyMap as $mKey => $mData) {
    $rate = $mData['applyCount'] > 0 ? number_format(($mData['joinedCount'] / $mData['applyCount']) * 100, 1) : '0.0';
    $mData['joinRate'] = $rate . '%';
    $monthlyStats[] = $mData;
}

$chartDates = array_reverse(array_slice(array_keys($weeklyMap), 0, 10));
$chartLabels = [];
$chartData = [];
foreach ($chartDates as $dStr) {
    $chartLabels[] = date('m/d', strtotime(str_replace('/', '-', $dStr)));
    $chartData[] = $weeklyMap[$dStr]['applyCount'];
}

$meetingCount = max(1, count($weeklyMap));
$avgVisitorCount = number_format($totalApplyCount / $meetingCount, 1);

$targetJoinGoal = 12;
$achievementRate = number_format(($totalJoinedCount / $targetJoinGoal) * 100, 1);
$joinRate = $totalApplyCount > 0 ? number_format(($totalJoinedCount / $totalApplyCount) * 100, 1) : '0.0';
$hearingRate = $totalApplyCount > 0 ? number_format(($totalHearingCount / $totalApplyCount) * 100, 1) : '0.0';

// Generate BNI Terms List for selection
$bniTermsList = [
    ['label' => '第2期 (2026/04/01〜)', 'value' => '2026/04/01'],
    ['label' => '第1期 (2025/10/01〜)', 'value' => '2025/10/01'],
    ['label' => '全期間 (2024/10/01〜)', 'value' => '2024/10/01']
];

sendJsonResponse([
    'success' => true,
    'startDateStr' => $startDateStr,
    'bniTermsList' => $bniTermsList,
    'nextThuStr' => $nextThuStr,
    'afterNextThuStr' => $afterNextThuStr,
    'lastThuStr' => $lastThuStr,
    'metrics' => [
        'applyCount' => $totalApplyCount,
        'joinedCount' => $totalJoinedCount,
        'targetJoinGoal' => $targetJoinGoal,
        'achievementRate' => (string)$achievementRate,
        'joinRate' => (string)$joinRate,
        'nextThuCount' => count($nextMeetingVisitors),
        'afterNextThuCount' => 0,
        'avgVisitorCount' => (string)$avgVisitorCount,
        'feedbackRate' => '85.0',
        'hearingRate' => (string)$hearingRate,
        'hotVisitorCount' => count($hotVisitors)
    ],
    'chart' => [
        'labels' => $chartLabels,
        'data' => $chartData
    ],
    'tables' => [
        'hotVisitors' => $hotVisitors,
        'nextMeeting' => $nextMeetingVisitors,
        'lastMeeting' => $lastMeetingVisitors,
        'oneMonthFollowup' => $oneMonthFollowupVisitors,
        'weeklyStats' => $weeklyStats,
        'monthlyStats' => $monthlyStats
    ]
]);

