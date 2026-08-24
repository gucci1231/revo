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

        $pipelineCounts = [
            '未' => 0,
            '検討中' => 0,
            '申込書提出' => 0,
            '入金待ち' => 0,
            '審査' => 0,
            '入会済' => 0
        ];

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

        // 1. 各申込レコードごとの定例会集計 & 最新アクション紐付け
        $periodVisitors = [];
        foreach ($visitors as $r) {
            $eDate = trim($r['eventDate']);
            $eTs = strtotime(str_replace('/', '-', $eDate));

            // Filter by start_date
            if ($eTs && $eTs < $startDateTs) {
                continue;
            }

            $rawJoin = trim($r['isJoined'] ?? '');
            $isJoinedBool = ($rawJoin === '入会済' || $rawJoin === '済' || $rawJoin === '入会');
            $isAttendedBool = ($r['isAttended'] === '参加' || $r['isAttended'] === '済');

            $totalApplyCount++;
            if ($isJoinedBool) $totalJoinedCount++;
            if ($isAttendedBool) $totalAttendedCount++;
            if ($r['hasHearingSheet']) $totalHearingCount++;

            $r['latestActionPlan'] = $apMap[(string)$r['id']] ?? null;

            if ($eDate === $nextThuFull || strpos($eDate, $nextThuStr) !== false) {
                $nextMeetingVisitors[] = $r;
            } else if ($eDate === $lastThuFull || strpos($eDate, $lastThuStr) !== false) {
                $lastMeetingVisitors[] = $r;
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
                $feel = strtoupper(trim($r['feelAbc'] ?? ''));
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

            $periodVisitors[] = $r;
        }

        // 2. ユニークビジターへの名寄せ（同一人物の2回参加を1人に統合）
        $uniqueVisitors = $this->deduplicateVisitorsList($periodVisitors, $apMap);

        // 3. ユニークビジターに対するパイプライン・最優先フォロー・1ヶ月フォロー集計
        foreach ($uniqueVisitors as $uv) {
            $rawJoin = trim($uv['isJoined'] ?? '');
            $isJoinedBool = ($rawJoin === '入会済' || $rawJoin === '済' || $rawJoin === '入会');
            $isRejected = ($rawJoin === '見送り' || $rawJoin === 'フォロー終了');

            if ($isJoinedBool) {
                $pipelineCounts['入会済']++;
            } else if ($rawJoin === '審査' || $rawJoin === 'メンバーシップ審査' || $rawJoin === '審査中') {
                $pipelineCounts['審査']++;
            } else if ($rawJoin === '入金待ち') {
                $pipelineCounts['入金待ち']++;
            } else if ($rawJoin === '申込書提出') {
                $pipelineCounts['申込書提出']++;
            } else if ($rawJoin === '検討中') {
                $pipelineCounts['検討中']++;
            } else if (!$isRejected) {
                $pipelineCounts['未']++;
            }

            $feel = strtoupper(trim($uv['feelAbc'] ?? ''));
            if ($feel === 'A' && !$isJoinedBool && !$isRejected) {
                $hotVisitors[] = $uv;
            }

            $uDate = trim($uv['eventDate'] ?? '');
            $uTs = strtotime(str_replace('/', '-', $uDate));
            if ($uTs && $uTs >= $oneMonthAgoTs && !$isJoinedBool && !$isRejected) {
                $oneMonthFollowupVisitors[] = $uv;
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
            ['label' => '第2期 (2026/04/01〜)', 'value' => '2026/04/01', 'dateStr' => '2026/04/01'],
            ['label' => '第1期 (2025/10/01〜)', 'value' => '2025/10/01', 'dateStr' => '2025/10/01'],
            ['label' => '全期間 (2024/10/01〜)', 'value' => '2024/10/01', 'dateStr' => '2024/10/01']
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
            'pipelineCounts' => $pipelineCounts,
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

    /**
     * 重複ビジター（同一人物の複数回参加）を名寄せして1件に統合
     */
    private function deduplicateVisitorsList(array $list, array $apMap = []): array {
        if (empty($list)) return [];

        $result = [];
        $emailMap = [];
        $nameMap = [];
        $furiganaMap = [];

        foreach ($list as $r) {
            $rawName = trim($r['name'] ?? '');
            $isGeneric = ($rawName === '' || preg_match('/^ビジター\s*(no\.?\s*\d+)?$/i', $rawName));
            $emailKey = !empty($r['email']) ? $this->normalizeKey($r['email']) : '';
            $nameKey = !$isGeneric ? $this->normalizeKey($rawName) : '';
            $furiganaKey = (!empty($r['furigana']) && !$isGeneric) ? $this->normalizeKey($r['furigana']) : '';

            $matchIdx = null;
            if ($emailKey !== '' && isset($emailMap[$emailKey])) {
                $matchIdx = $emailMap[$emailKey];
            } else if ($nameKey !== '' && isset($nameMap[$nameKey])) {
                $matchIdx = $nameMap[$nameKey];
            } else if ($furiganaKey !== '' && isset($furiganaMap[$furiganaKey])) {
                $matchIdx = $furiganaMap[$furiganaKey];
            }

            if ($matchIdx !== null) {
                $existing = &$result[$matchIdx];
                if (!isset($existing['allIds'])) $existing['allIds'] = [(string)$existing['id']];
                if (!in_array((string)$r['id'], $existing['allIds'], true)) {
                    $existing['allIds'][] = (string)$r['id'];
                }
                $existing['visitCount'] = count($existing['allIds']);

                // 最新日程のレコードを基本情報として優先
                $isNewer = (!empty($r['eventDate']) && (empty($existing['eventDate']) || $r['eventDate'] >= $existing['eventDate']));
                if ($isNewer) {
                    $existing['id'] = $r['id'];
                    $existing['isAttended'] = $r['isAttended'] ?? '未';
                    $existing['eventDate'] = $r['eventDate'];
                    if (!empty($r['inviter'])) $existing['inviter'] = $r['inviter'];
                    if (!empty($r['profession'])) $existing['profession'] = $r['profession'];
                    if (!empty($r['company'])) $existing['company'] = $r['company'];
                    if (!empty($r['remarks'])) $existing['remarks'] = $r['remarks'];
                }

                // 入会ステータスはより進んでいる方を採用
                $curPriority = $this->getJoinPriority($existing['isJoined'] ?? '');
                $newPriority = $this->getJoinPriority($r['isJoined'] ?? '');
                if ($newPriority > $curPriority) {
                    $existing['isJoined'] = $r['isJoined'];
                }

                // 感触ランクは最高評価（A > B > C）を採用
                $curFeel = strtoupper(trim($existing['feelAbc'] ?? ''));
                $newFeel = strtoupper(trim($r['feelAbc'] ?? ''));
                if ($newFeel === 'A' || ($newFeel === 'B' && $curFeel !== 'A') || ($newFeel === 'C' && empty($curFeel))) {
                    $existing['feelAbc'] = $newFeel;
                }

                // 最新アクションプランの紐付け
                if (!empty($apMap[(string)$r['id']])) {
                    $existing['latestActionPlan'] = $apMap[(string)$r['id']];
                }
            } else {
                $item = $r;
                $item['allIds'] = [(string)$item['id']];
                $item['visitCount'] = 1;
                $item['feelAbc'] = strtoupper(trim($item['feelAbc'] ?? ''));
                if (!empty($apMap[(string)$item['id']])) {
                    $item['latestActionPlan'] = $apMap[(string)$item['id']];
                }
                $idx = count($result);
                $result[] = $item;

                if ($emailKey !== '') $emailMap[$emailKey] = $idx;
                if ($nameKey !== '') $nameMap[$nameKey] = $idx;
                if ($furiganaKey !== '') $furiganaMap[$furiganaKey] = $idx;
            }
        }

        return $result;
    }

    private function normalizeKey(?string $str): string {
        if (!$str) return '';
        $s = mb_convert_kana($str, 'KVas', 'UTF-8');
        $s = mb_convert_kana($s, 'c', 'UTF-8');
        $s = preg_replace('/[・·\.\,\-\_\s\x{3000}\t\r\n]+/u', '', $s);
        return mb_strtolower($s, 'UTF-8');
    }

    private function getJoinPriority(string $status): int {
        switch ($status) {
            case '入会済': case '済': case '入会': return 5;
            case '審査': case 'メンバーシップ審査': case '審査中': return 4;
            case '入金待ち': return 3;
            case '申込書提出': return 2;
            case '検討中': return 1;
            default: return 0;
        }
    }
}
