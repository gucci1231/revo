<?php
namespace Api\Services;

use Api\Repositories\VisitorRepository;
use Api\Repositories\SettingRepository;
use Api\Repositories\ActionPlanRepository;

class DashboardService {
    private VisitorRepository $visitorRepo;
    private SettingRepository $settingRepo;
    private ActionPlanRepository $actionPlanRepo;

    public function __construct(
        ?VisitorRepository $visitorRepo = null,
        ?SettingRepository $settingRepo = null,
        ?ActionPlanRepository $actionPlanRepo = null
    ) {
        $this->visitorRepo = $visitorRepo ?? new VisitorRepository();
        $this->settingRepo = $settingRepo ?? new SettingRepository();
        $this->actionPlanRepo = $actionPlanRepo ?? new ActionPlanRepository();
    }

    public function getDashboardData(?string $requestedStartDate = null): array {
        $visitors = $this->visitorRepo->getDashboardVisitors();

        $startDateStr = $requestedStartDate;
        if (!$startDateStr) {
            $startDateStr = $this->settingRepo->getByKey('start_date', '2026/04/01');
        }

        $startDateTs = strtotime(str_replace('/', '-', $startDateStr));
        if (!$startDateTs) {
            $startDateTs = strtotime('2026-04-01');
            $startDateStr = '2026/04/01';
        }

        $nextThuFull = $this->getNextThursday(0);
        $afterNextThuFull = $this->getNextThursday(1);
        $lastThuFull = $this->getPreviousThursday();

        $nextThuStr = date('m/d', strtotime(str_replace('/', '-', $nextThuFull)));
        $afterNextThuStr = date('m/d', strtotime(str_replace('/', '-', $afterNextThuFull)));
        $lastThuStr = date('m/d', strtotime(str_replace('/', '-', $lastThuFull)));

        $totalApplyCount = 0;
        $totalJoinedCount = 0;
        $totalAttendedCount = 0;
        $totalHearingCount = 0;
        $hotVisitors = [];
        $nextMeetingVisitors = [];
        $lastMeetingVisitors = [];
        $oneMonthFollowupVisitors = [];

        $weeklyMap = [];
        $monthlyMap = [];

        $actionPlans = $this->actionPlanRepo->getAllWithVisitor(null, 100);
        $todayStr = date('Y-m-d');
        $apMap = [];
        $pendingActionPlansCount = 0;
        $overdueActionPlansCount = 0;

        foreach ($actionPlans as $ap) {
            $vId = (string)$ap['visitor_id'];
            if (!isset($apMap[$vId])) {
                $apMap[$vId] = $ap;
            } else if ((int)$apMap[$vId]['is_completed'] === 1 && (int)$ap['is_completed'] === 0) {
                $apMap[$vId] = $ap;
            }

            if ((int)$ap['is_completed'] === 0) {
                $pendingActionPlansCount++;
                if (!empty($ap['due_date']) && $ap['due_date'] < $todayStr) {
                    $overdueActionPlansCount++;
                }
            }
        }

        foreach ($visitors as $r) {
            $eDate = trim($r['eventDate']);
            $eTs = strtotime(str_replace('/', '-', $eDate));

            // Filter by start_date
            if ($eTs && $eTs < $startDateTs) {
                continue;
            }

            $isJoinedBool = ($r['isJoined'] === '入会済' || $r['isJoined'] === '済' || $r['isJoined'] === '入会');
            $isAttendedBool = ($r['isAttended'] === '参加' || $r['isAttended'] === '済');

            $totalApplyCount++;
            if ($isJoinedBool) $totalJoinedCount++;
            if ($isAttendedBool) $totalAttendedCount++;
            if ($r['hasHearingSheet']) $totalHearingCount++;

            $r['latestActionPlan'] = $apMap[(string)$r['id']] ?? null;

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

        $bniTermsList = [
            ['label' => '第2期 (2026/04/01〜)', 'value' => '2026/04/01'],
            ['label' => '第1期 (2025/10/01〜)', 'value' => '2025/10/01'],
            ['label' => '全期間 (2024/10/01〜)', 'value' => '2024/10/01']
        ];

        return [
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
                'hotVisitorCount' => count($hotVisitors),
                'pendingActionPlansCount' => $pendingActionPlansCount,
                'overdueActionPlansCount' => $overdueActionPlansCount
            ],
            'chart' => [
                'labels' => $chartLabels,
                'data' => $chartData
            ],
            'tables' => [
                'actionPlans' => $actionPlans,
                'hotVisitors' => $hotVisitors,
                'nextMeeting' => $nextMeetingVisitors,
                'lastMeeting' => $lastMeetingVisitors,
                'oneMonthFollowup' => $oneMonthFollowupVisitors,
                'weeklyStats' => $weeklyStats,
                'monthlyStats' => $monthlyStats
            ]
        ];
    }

    private function getNextThursday(int $offsetWeeks = 0): string {
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

    private function getPreviousThursday(): string {
        $ts = time();
        $dayOfWeek = date('w', $ts);
        $daysSinceThu = ($dayOfWeek - 4 + 7) % 7;
        if ($daysSinceThu === 0) $daysSinceThu = 7;
        return date('Y/m/d', strtotime("-{$daysSinceThu} days", $ts));
    }
}
