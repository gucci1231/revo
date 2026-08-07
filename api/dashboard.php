<?php
require_once __DIR__ . '/db.php';

$stmt = $pdo->query("
    SELECT 
        v.id, v.visitor_name as name, v.furigana, v.company, v.profession, v.inviter, v.event_date as eventDate,
        COALESCE(s.is_attended, '未') as isAttended,
        COALESCE(s.is_joined, '未') as isJoined,
        COALESCE(s.is_1to1, '未') as is1to1,
        COALESCE(h.feel_abc, '') as feelAbc,
        COALESCE(h.q7, '') as q7,
        COALESCE(h.orient_user, '') as orientUser,
        COALESCE(h.orient_memo, '') as orientMemo,
        CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet
    FROM visitors v
    LEFT JOIN visitors_status s ON v.id = s.visitor_id
    LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
");
$visitors = $stmt->fetchAll();

$totalApplyCount = count($visitors);
$totalJoinedCount = 0;
$total1to1Count = 0;
$totalHearingCount = 0;
$hotVisitors = [];
$nextMeetingVisitors = [];

$today = date('Y/m/d');

foreach ($visitors as $r) {
    if ($r['isJoined'] === '入会済' || $r['isJoined'] === '済') $totalJoinedCount++;
    if ($r['is1to1'] === '済') $total1to1Count++;
    if ($r['hasHearingSheet']) $totalHearingCount++;

    $feel = strtoupper(trim($r['feelAbc']));
    $isJoinedBool = ($r['isJoined'] === '入会済' || $r['isJoined'] === '済');

    if ($feel === 'A' && !$isJoinedBool) {
        $hotVisitors[] = $r;
    }
}

$targetJoinGoal = 12;
$achievementRate = $targetJoinGoal > 0 ? number_format(($totalJoinedCount / $targetJoinGoal) * 100, 1) : '0.0';
$joinRate = $totalApplyCount > 0 ? number_format(($totalJoinedCount / $totalApplyCount) * 100, 1) : '0.0';
$hearingRate = $totalApplyCount > 0 ? number_format(($totalHearingCount / $totalApplyCount) * 100, 1) : '0.0';

sendJsonResponse([
    'success' => true,
    'nextThuStr' => date('m/d'),
    'afterNextThuStr' => date('m/d', strtotime('+7 days')),
    'metrics' => [
        'applyCount' => $totalApplyCount,
        'joinedCount' => $totalJoinedCount,
        'targetJoinGoal' => $targetJoinGoal,
        'achievementRate' => (string)$achievementRate,
        'joinRate' => (string)$joinRate,
        'nextThuCount' => 0,
        'avgVisitorCount' => '4.2',
        'feedbackRate' => '80.0',
        'hearingRate' => (string)$hearingRate,
        'hotVisitorCount' => count($hotVisitors)
    ],
    'chart' => [
        'labels' => [],
        'data' => []
    ],
    'tables' => [
        'hotVisitors' => $hotVisitors,
        'nextMeeting' => $nextMeetingVisitors
    ]
]);
