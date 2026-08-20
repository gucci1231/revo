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
        $oneMonthAgoTs = strtotime('-30 days');

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
            $isRejected = ($r['isJoined'] === '見送り');

            $totalApplyCount++;
            if ($isJoinedBool) $totalJoinedCount++;
            if ($isAttendedBool) $totalAttendedCount++;
            if ($r['hasHearingSheet']) $totalHearingCount++;

            $r['latestActionPlan'] = $apMap[(string)$r['id']] ?? null;

            $feel = strtoupper(trim($r['feelAbc']));
            if ($feel === 'A' && !$isJoinedBool && !$isRejected) {
                $hotVisitors[] = $r;
            }

            if ($eDate === $nextThuFull || strpos($eDate, $nextThuStr) !== false) {
                $nextMeetingVisitors[] = $r;
            } else if ($eDate === $lastThuFull || strpos($eDate, $lastThuStr) !== false) {
                $lastMeetingVisitors[] = $r;
            }

            if ($eTs && $eTs >= $oneMonthAgoTs && !$isJoinedBool && !$isRejected) {
                $oneMonthFollowupVisitors[] = $r;
            }

            if ($eDate !== '') {
                if (!isset($weeklyMap[$eDate])) {
                    $weeklyMap[$eDate] = [
                        'date' => $eDate,
                        'applyCount' => 0,
                        'attendedCount' => 0,
                        'joinedCount' => 0,
                        'feelCounts' => ['A' => 0, 'B' => 0, 'C' => 0, 'none' => 0]
                    ];
                }
                $weeklyMap[$eDate]['applyCount']++;
                if ($isAttendedBool) $weeklyMap[$eDate]['attendedCount']++;
                if ($isJoinedBool) $weeklyMap[$eDate]['joinedCount']++;
                if ($feel === 'A' || $feel === 'B' || $feel === 'C') {
                    $weeklyMap[$eDate]['feelCounts'][$feel]++;
                } else {
                    $weeklyMap[$eDate]['feelCounts']['none']++;
                }

                $monthKey = substr($eDate, 0, 7);
                if (preg_match('/^\d{4}[\/\-]\d{2}$/', $monthKey)) {
                    if (!isset($monthlyMap[$monthKey])) {
                        $monthlyMap[$monthKey] = [
                            'month' => $monthKey,
                            'applyCount' => 0,
                            'attendedCount' => 0,
                            'joinedCount' => 0,
                            'feelCounts' => ['A' => 0, 'B' => 0, 'C' => 0, 'none' => 0]
                        ];
                    }
                    $monthlyMap[$monthKey]['applyCount']++;
                    if ($isAttendedBool) $monthlyMap[$monthKey]['attendedCount']++;
                    if ($isJoinedBool) $monthlyMap[$monthKey]['joinedCount']++;
                    if ($feel === 'A' || $feel === 'B' || $feel === 'C') {
                        $monthlyMap[$monthKey]['feelCounts'][$feel]++;
                    } else {
                        $monthlyMap[$monthKey]['feelCounts']['none']++;
                    }
                }
            }
        }

        // 指定期間（startDate〜today）内の全木曜日（定例会開催日）を weeklyMap に事前登録（0名週の欠落防止）
        $todayTs = time();
        $curThuTs = $startDateTs;
        while ($curThuTs <= $todayTs) {
            if (date('w', $curThuTs) == 4) {
                $thuDateStr = date('Y/m/d', $curThuTs);
                if (!isset($weeklyMap[$thuDateStr])) {
                    $weeklyMap[$thuDateStr] = [
                        'date' => $thuDateStr,
                        'applyCount' => 0,
                        'attendedCount' => 0,
                        'joinedCount' => 0,
                        'feelCounts' => ['A' => 0, 'B' => 0, 'C' => 0, 'none' => 0]
                    ];
                }
            }
            $curThuTs = strtotime('+1 day', $curThuTs);
        }

        // 月ごとの定例会開催数（経過した木曜日数）を算出
        $monthlyMeetingCounts = [];
        foreach ($monthlyMap as $mKey => $mData) {
            $ymClean = str_replace('/', '-', $mKey);
            $firstDayTs = strtotime($ymClean . '-01');
            $lastDayTs = strtotime(date('Y-m-t', $firstDayTs));
            $endTs = min($lastDayTs, $todayTs);

            $thuCount = 0;
            $cTs = $firstDayTs;
            while ($cTs <= $endTs) {
                if (date('w', $cTs) == 4) {
                    $thuCount++;
                }
                $cTs = strtotime('+1 day', $cTs);
            }

            if ($firstDayTs > $todayTs) {
                $thuCountFuture = 0;
                $fTs = $firstDayTs;
                while ($fTs <= $lastDayTs) {
                    if (date('w', $fTs) == 4) $thuCountFuture++;
                    $fTs = strtotime('+1 day', $fTs);
                }
                $monthlyMeetingCounts[$mKey] = max(1, $thuCountFuture);
            } else {
                $monthlyMeetingCounts[$mKey] = max(1, $thuCount);
            }
        }

        krsort($weeklyMap);
        $weeklyStats = [];
        foreach ($weeklyMap as $wKey => $wData) {
            $total = $wData['applyCount'];
            $wData['feelRates'] = [
                'A' => $total > 0 ? number_format(($wData['feelCounts']['A'] / $total) * 100, 1) . '%' : '0.0%',
                'B' => $total > 0 ? number_format(($wData['feelCounts']['B'] / $total) * 100, 1) . '%' : '0.0%',
                'C' => $total > 0 ? number_format(($wData['feelCounts']['C'] / $total) * 100, 1) . '%' : '0.0%',
            ];
            $monthKey = substr($wKey, 0, 7);
            $wGoal = $this->settingRepo->resolveGoalsForMonth($monthKey);
            $wData['targetVisitorsWeekly'] = $wGoal['target_visitors_weekly'] ?? 4;
            $weeklyStats[] = $wData;
        }

        krsort($monthlyMap);
        $monthlyStats = [];
        foreach ($monthlyMap as $mKey => $mData) {
            $total = $mData['applyCount'];
            $rate = $total > 0 ? number_format(($mData['joinedCount'] / $total) * 100, 1) : '0.0';
            $mData['joinRate'] = $rate . '%';
            $mData['feelRates'] = [
                'A' => $total > 0 ? number_format(($mData['feelCounts']['A'] / $total) * 100, 1) . '%' : '0.0%',
                'B' => $total > 0 ? number_format(($mData['feelCounts']['B'] / $total) * 100, 1) . '%' : '0.0%',
                'C' => $total > 0 ? number_format(($mData['feelCounts']['C'] / $total) * 100, 1) . '%' : '0.0%',
            ];
            $mResolvedGoal = $this->settingRepo->resolveGoalsForMonth($mKey);
            $meetingCountMonth = $monthlyMeetingCounts[$mKey] ?? 1;
            $avgVisitorsWeekly = number_format($total / max(1, $meetingCountMonth), 1);

            $mData['goal'] = $mResolvedGoal;
            $mData['targetJoined'] = $mResolvedGoal['target_joined'] ?? 2;
            $mData['targetVisitorsWeekly'] = $mResolvedGoal['target_visitors_weekly'] ?? 4;
            $mData['avgVisitorsWeekly'] = $avgVisitorsWeekly;
            $mData['meetingCount'] = $meetingCountMonth;
            $mData['targetJoinRate'] = ($mResolvedGoal['target_join_rate'] ?? 25.0) . '%';
            $mData['targetHearingRate'] = ($mResolvedGoal['target_hearing_rate'] ?? 100.0) . '%';
            $mData['isCustomGoal'] = !empty($mResolvedGoal['is_custom']);
            $mData['goalSource'] = $mResolvedGoal['source'] ?? 'default';
            $monthlyStats[] = $mData;
        }

        // グラフ用データ: 期のスタートから現在までの全定例会（時系列昇順）
        $chartDatesAsc = array_keys($weeklyMap);
        sort($chartDatesAsc);
        $chartLabels = [];
        $chartData = [];
        foreach ($chartDatesAsc as $dStr) {
            if ($dStr >= $startDateStr) {
                $chartLabels[] = date('m/d', strtotime(str_replace('/', '-', $dStr)));
                $chartData[] = $weeklyMap[$dStr]['applyCount'];
            }
        }

        // 期間全体の経過木曜日数
        $totalMeetingThursdays = 0;
        $cTs = $startDateTs;
        while ($cTs <= $todayTs) {
            if (date('w', $cTs) == 4) {
                $totalMeetingThursdays++;
            }
            $cTs = strtotime('+1 day', $cTs);
        }
        $meetingCount = max(1, $totalMeetingThursdays);
        $avgVisitorCount = number_format($totalApplyCount / $meetingCount, 1);

        // Calculate dynamic targetJoinGoal for the term (6 months by default or based on months involved)
        $termMonthsCount = 6;
        $targetJoinGoal = 0;
        $startYearMonth = date('Y/m', $startDateTs);
        $termMonthTs = $startDateTs;
        for ($i = 0; $i < $termMonthsCount; $i++) {
            $ym = date('Y/m', $termMonthTs);
            $mGoal = $this->settingRepo->resolveGoalsForMonth($ym);
            $targetJoinGoal += ($mGoal['target_joined'] ?? 2);
            $termMonthTs = strtotime('+1 month', $termMonthTs);
        }
        if ($targetJoinGoal <= 0) $targetJoinGoal = 12;

        $currentYm = date('Y/m');
        $currentMonthGoal = $this->settingRepo->resolveGoalsForMonth($currentYm);

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
                'targetVisitorsWeekly' => $currentMonthGoal['target_visitors_weekly'] ?? 4,
                'targetHearingRate' => ($currentMonthGoal['target_hearing_rate'] ?? 100.0) . '%',
                'targetJoinRate' => ($currentMonthGoal['target_join_rate'] ?? 25.0) . '%',
                'achievementRate' => (string)$achievementRate,
                'joinRate' => (string)$joinRate,
                'nextThuCount' => count($nextMeetingVisitors),
                'afterNextThuCount' => 0,
                'avgVisitorCount' => (string)$avgVisitorCount,
                'feedbackRate' => '85.0',
                'hearingRate' => (string)$hearingRate,
                'hotVisitorCount' => count($hotVisitors),
                'pendingActionPlansCount' => $pendingActionPlansCount,
                'overdueActionPlansCount' => $overdueActionPlansCount,
                'currentMonth' => $currentYm,
                'currentMonthGoal' => $currentMonthGoal
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
