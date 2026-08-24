<?php
namespace Api\Services;

use Api\Repositories\VisitorRepository;
use Api\Repositories\ActionPlanRepository;
use Api\Repositories\SettingRepository;
use Api\Repositories\MemberRepository;

class ReportContextService {
    private VisitorRepository $visitorRepo;
    private ActionPlanRepository $actionPlanRepo;
    private SettingRepository $settingRepo;
    private MemberRepository $memberRepo;

    public function __construct(
        ?VisitorRepository $visitorRepo = null,
        ?ActionPlanRepository $actionPlanRepo = null,
        ?SettingRepository $settingRepo = null,
        ?MemberRepository $memberRepo = null
    ) {
        $this->visitorRepo = $visitorRepo ?? new VisitorRepository();
        $this->actionPlanRepo = $actionPlanRepo ?? new ActionPlanRepository();
        $this->settingRepo = $settingRepo ?? new SettingRepository();
        $this->memberRepo = $memberRepo ?? new MemberRepository();
    }

    /**
     * 次回定例会（木曜日）の日付文字列を取得
     */
    public function getNextMeetingDate(int $offsetWeeks = 0): string {
        $ts = time();
        $dayOfWeek = intval(date('w', $ts));
        $daysUntilThu = (4 - $dayOfWeek + 7) % 7;
        if ($daysUntilThu === 0 && intval(date('H')) >= 12) {
            $daysUntilThu = 7;
        }
        $targetTs = strtotime("+{$daysUntilThu} days", $ts);
        if ($offsetWeeks > 0) {
            $targetTs = strtotime("+{$offsetWeeks} weeks", $targetTs);
        }
        $weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        $w = $weekdays[intval(date('w', $targetTs))];
        return date('Y/m/d', $targetTs) . "({$w})";
    }

    /**
     * プレースホルダー置換用コンテキストマップを実データから生成
     */
    public function buildContext(array $extraParams = []): array {
        $todayTs = time();
        $weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        $todayStr = date('Y/m/d', $todayTs) . '(' . $weekdays[intval(date('w', $todayTs))] . ')';
        $meetingDateStr = $this->getNextMeetingDate();
        $origin = 'https://revo.k-d-o.biz';

        // 全ビジター取得
        $allVisitors = $this->visitorRepo->getAllWithStatusAndHearing();
        $allActionPlans = $this->actionPlanRepo->getAllWithVisitor(null, 500);

        // 1. 次回定例会申込ビジター
        $cleanMeetingDate = preg_replace('/\([^\)]+\)/', '', $meetingDateStr);
        $upcomingVisitors = [];
        $inviterMap = [];

        foreach ($allVisitors as $v) {
            $rawEventDate = $v['event_date'] ?? $v['eventDate'] ?? '';
            $evDate = str_replace('-', '/', substr($rawEventDate, 0, 10));
            if ($evDate === $cleanMeetingDate || strpos($rawEventDate, $cleanMeetingDate) !== false) {
                $upcomingVisitors[] = $v;
            }
            $inv = trim($v['inviter'] ?? '');
            if (!empty($inv)) {
                $inviterMap[$inv] = ($inviterMap[$inv] ?? 0) + 1;
            }
        }

        $currentAppliedCount = count($upcomingVisitors);
        $weeklyTarget = 5; // デフォルト目標
        $targetDiff = max(0, $weeklyTarget - $currentAppliedCount);
        $achievementRate = $weeklyTarget > 0 ? round(($currentAppliedCount / $weeklyTarget) * 100) : 0;
        $diffColor = $targetDiff === 0 ? '#059669' : '#dc2626';

        // 2. 招待貢献メンバー一覧 HTML / LINE
        arsort($inviterMap);
        $topInviters = array_slice($inviterMap, 0, 5, true);
        $inviterHtml = '<div style="background:#f8fafc; border:1px solid #e6ebf1; border-radius:10px; padding:12px 14px;">';
        $inviterLine = '';

        if (!empty($topInviters)) {
            $keys = array_keys($topInviters);
            $lastIndex = count($keys) - 1;
            foreach ($keys as $idx => $name) {
                $count = $topInviters[$name];
                $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
                $borderStyle = $idx < $lastIndex ? 'border-bottom:1px solid #edf2f7;' : '';
                $inviterHtml .= "<div style=\"display:flex; justify-content:space-between; align-items:center; padding:7px 0; font-size:12.5px; {$borderStyle}\"><strong style=\"color:#0a2540;\">{$safeName} 様</strong><span style=\"background:#eff6ff; color:#0071e3; font-weight:700; font-size:11px; padding:2px 8px; border-radius:5px;\">{$count}名 招待中</span></div>";
                $inviterLine .= "・{$name} 様: {$count}名 招待中\n";
            }
        } else {
            $inviterHtml .= '<div style="font-size:12px; color:#8898aa; text-align:center; padding:8px;">現在招待申請を受付中です</div>';
            $inviterLine = '（現在招待申請を受付中です）';
        }
        $inviterHtml .= '</div>';

        // 3. 参加予定ビジターカード一覧 HTML / LINE
        $upHtml = '';
        $upLine = '';
        if (!empty($upcomingVisitors)) {
            foreach ($upcomingVisitors as $i => $v) {
                $name = htmlspecialchars($v['name'] ?? $v['visitor_name'] ?? 'ビジター', ENT_QUOTES, 'UTF-8');
                $company = htmlspecialchars($v['company'] ?? '', ENT_QUOTES, 'UTF-8');
                $category = htmlspecialchars($v['business_category'] ?? $v['profession'] ?? '専門分野', ENT_QUOTES, 'UTF-8');
                $inv = htmlspecialchars($v['inviter'] ?? 'チャプター', ENT_QUOTES, 'UTF-8');

                $companyDisp = !empty($company) ? "<span style=\"font-size:11.5px; font-weight:normal; color:#64748b;\">({$company})</span>" : "";

                $upHtml .= "<div style=\"background:#f8fafc; border:1px solid #e6ebf1; border-radius:10px; padding:12px 14px; margin-bottom:8px;\">
                  <table style=\"width:100%; border-collapse:collapse;\">
                    <tr>
                      <td style=\"font-weight:800; font-size:13px; color:#0a2540;\">{$name} 様 {$companyDisp}</td>
                      <td style=\"text-align:right;\"><span style=\"background:#eff6ff; color:#0071e3; font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:5px;\">招待: {$inv} 様</span></td>
                    </tr>
                    <tr>
                      <td colspan=\"2\" style=\"font-size:11px; color:#8898aa; padding-top:4px;\">専門分野: <strong style=\"color:#425466;\">{$category}</strong></td>
                    </tr>
                  </table>
                </div>";
                $idxNum = $i + 1;
                $vNameRaw = $v['name'] ?? $v['visitor_name'] ?? '';
                $vCatRaw = $v['business_category'] ?? $v['profession'] ?? '';
                $upLine .= "{$idxNum}. {$vNameRaw} 様 (" . ($v['company'] ?? '') . ") / 専門: {$vCatRaw} (招待: " . ($v['inviter'] ?? '') . " 様)\n";
            }
        } else {
            $upHtml = '<div style="background:#f8fafc; border:1px solid #e6ebf1; border-radius:10px; padding:16px; text-align:center; font-size:12px; color:#8898aa;">次回定例会の参加予定ビジターはまだ登録されていません。</div>';
            $upLine = '（参加予定ビジターはまだ登録されていません）';
        }

        // 4. アクション・フォロー関連集計
        $completedActionsCount = 0;
        $pendingTodosCount = 0;
        $todayDueCount = 0;
        $todayDueHtml = '<div style="background:#ffffff; border:1px solid #e6ebf1; border-radius:10px; overflow:hidden; margin:14px 0;"><table style="width:100%; font-size:12px; border-collapse:collapse;"><tr style="background:#fef2f2; border-bottom:1px solid #fecaca; color:#991b1b; font-size:10.5px; font-weight:700; text-transform:uppercase;"><th style="padding:10px 12px; text-align:left;">期日</th><th style="padding:10px 12px; text-align:left;">ビジター名</th><th style="padding:10px 12px; text-align:left;">アクション内容</th><th style="padding:10px 12px; text-align:left;">担当者</th></tr>';
        $todayDueRows = '';
        $todayDueLine = '';

        $todayDateOnly = date('Y-m-d');
        foreach ($allActionPlans as $ap) {
            $isComp = intval($ap['is_completed'] ?? 0);
            if ($isComp === 1 || !empty($ap['completed_at'])) {
                $completedActionsCount++;
            } else {
                $pendingTodosCount++;
                $dueDate = substr($ap['due_date'] ?? '', 0, 10);
                if ($dueDate === $todayDateOnly || ($dueDate < $todayDateOnly && !empty($dueDate))) {
                    $todayDueCount++;
                    $vName = htmlspecialchars($ap['visitor_name'] ?? 'ビジター', ENT_QUOTES, 'UTF-8');
                    $act = htmlspecialchars($ap['action_text'] ?? $ap['action'] ?? $ap['content'] ?? 'フォロー', ENT_QUOTES, 'UTF-8');
                    $assignee = htmlspecialchars($ap['assignee_name'] ?? '担当者', ENT_QUOTES, 'UTF-8');
                    $isOverdue = $dueDate < $todayDateOnly;
                    $dueLabel = $isOverdue ? '超過' : '本日中';
                    $dueColor = '#dc2626';

                    $todayDueRows .= "<tr>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; color:{$dueColor}; font-weight:800; font-size:11px;\">{$dueLabel}</td>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; font-weight:700; color:#0a2540;\">{$vName} 様</td>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; color:#334155; font-size:11.5px;\">{$act}</td>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; font-weight:700; color:#0071e3;\">{$assignee} 様</td>
                    </tr>";
                    $actRaw = $ap['action_text'] ?? $ap['action'] ?? $ap['content'] ?? 'フォロー';
                    $todayDueLine .= "・【{$dueLabel}】{$ap['visitor_name']} 様: {$actRaw} (担当: {$ap['assignee_name']} 様)\n";
                }
            }
        }
        if (empty($todayDueRows)) {
            $todayDueHtml .= '<tr><td colspan="4" style="padding:16px; text-align:center; color:#8898aa;">本日が期限のタスクはありません 🎉</td></tr>';
            $todayDueLine = '・本日が期限のタスクはありません 🎉';
        } else {
            $todayDueHtml .= $todayDueRows;
        }
        $todayDueHtml .= '</table></div>';

        // 5. フォロー中重要ビジター
        $followUpHtml = '<div style="background:#ffffff; border:1px solid #e6ebf1; border-radius:10px; overflow:hidden; margin:14px 0;"><table style="width:100%; font-size:12px; border-collapse:collapse;"><tr style="background:#f8fafc; border-bottom:1px solid #e6ebf1; color:#8898aa; font-size:10.5px; font-weight:700; text-transform:uppercase;"><th style="padding:10px 12px; text-align:left;">ビジター名</th><th style="padding:10px 12px; text-align:center;">感触</th><th style="padding:10px 12px; text-align:left;">次回アクション</th></tr>';
        $followUpRows = '';
        $followUpLine = '';
        $followCount = 0;

        foreach ($allVisitors as $v) {
            $feel = $v['feelAbc'] ?? $v['feel_raw'] ?? $v['feel'] ?? '';
            $followType = $v['followType'] ?? $v['follow_type'] ?? '';
            if ($followType === 'フォロー終了') continue;

            if (strpos($feel, 'A') !== false || strpos($feel, 'B') !== false) {
                $followCount++;
                if ($followCount <= 5) {
                    $vName = htmlspecialchars($v['name'] ?? $v['visitor_name'] ?? 'ビジター', ENT_QUOTES, 'UTF-8');
                    $category = htmlspecialchars($v['profession'] ?? $v['business_category'] ?? '', ENT_QUOTES, 'UTF-8');
                    $isA = strpos($feel, 'A') !== false;
                    $badge = $isA
                        ? '<span style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-weight:800; font-size:10.5px; padding:2px 6px; border-radius:4px;">🟢 Aランク</span>'
                        : '<span style="background:#fefce8; color:#ca8a04; border:1px solid #fef08a; font-weight:800; font-size:10.5px; padding:2px 6px; border-radius:4px;">🟡 Bランク</span>';
                    
                    $catDisp = !empty($category) ? "<span style=\"font-size:11px; color:#64748b; font-weight:normal;\">({$category})</span>" : "";
                    $nextAct = htmlspecialchars($v['nextActionText'] ?? $v['current_status'] ?? $v['next_action'] ?? '1to1日程調整', ENT_QUOTES, 'UTF-8');

                    $followUpRows .= "<tr>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; font-weight:700; color:#0a2540;\">{$vName} 様 {$catDisp}</td>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; text-align:center;\">{$badge}</td>
                      <td style=\"padding:10px 12px; border-bottom:1px solid #f0f4f8; color:#334155; font-size:11.5px;\">{$nextAct}</td>
                    </tr>";
                    $rankStr = $isA ? 'Aランク' : 'Bランク';
                    $rawName = $v['name'] ?? $v['visitor_name'] ?? 'ビジター';
                    $rawAct = $v['nextActionText'] ?? $v['current_status'] ?? $v['next_action'] ?? '1to1日程調整';
                    $followUpLine .= "・{$rawName} 様 ({$rankStr}): {$rawAct}\n";
                }
            }
        }
        if (empty($followUpRows)) {
            $followUpHtml .= '<tr><td colspan="3" style="padding:16px; text-align:center; color:#8898aa;">現在フォロー中のビジターはいません</td></tr>';
            $followUpLine = '（現在フォロー中のビジターはいません）';
        } else {
            $followUpHtml .= $followUpRows;
        }
        $followUpHtml .= '</table></div>';

        // メンターメッセージ
        $mentorMsg = "定例会（{$meetingDateStr}）まであと少しです！今週のチャプター目標【{$weeklyTarget}名】に対し、現在の確定申込は【{$currentAppliedCount}名】、目標達成まであと【{$targetDiff}名】です。日曜夜の今こそ、あなたの大切なビジネスパートナーに「木曜朝、一緒に参加しませんか？」と声を届ける最高のチャンスです！全員で必ず目標を達成させましょう！🔥";

        $defaultContext = [
            '{{定例会日付}}' => $meetingDateStr,
            '{{本日日付}}' => $todayStr,
            '{{週間目標数}}' => (string)$weeklyTarget,
            '{{現在申込数}}' => (string)$currentAppliedCount,
            '{{目標差分}}' => (string)$targetDiff,
            '{{目標差分カラー}}' => $diffColor,
            '{{達成率}}' => (string)$achievementRate,
            '{{メンターメッセージ}}' => $mentorMsg,
            '{{招待貢献メンバー一覧HTML}}' => $inviterHtml,
            '{{招待貢献メンバーLINE一覧}}' => trim($inviterLine),
            '{{参加予定ビジター数}}' => (string)count($upcomingVisitors),
            '{{参加予定ビジターカード一覧HTML}}' => $upHtml,
            '{{参加予定ビジターLINE一覧}}' => trim($upLine),
            '{{週間申込数}}' => (string)$currentAppliedCount,
            '{{完了アクション数}}' => (string)$completedActionsCount,
            '{{フォロー中件数}}' => (string)$followCount,
            '{{残ToDo数}}' => (string)$pendingTodosCount,
            '{{フォロー中ビジターテーブルHTML}}' => $followUpHtml,
            '{{フォロー中重要ビジターLINE一覧}}' => trim($followUpLine),
            '{{担当者名}}' => $extraParams['assignee_name'] ?? 'ビジホス担当',
            '{{ビジター名}}' => $extraParams['visitor_name'] ?? 'ビジター',
            '{{ビジター会社}}' => $extraParams['visitor_company'] ?? '株式会社パートナー',
            '{{ビジターカテゴリー}}' => $extraParams['business_category'] ?? '専門分野',
            '{{招待者名}}' => $extraParams['inviter_name'] ?? '招待メンバー',
            '{{アクション内容}}' => $extraParams['action_title'] ?? 'フォローアクション完了',
            '{{報告内容}}' => $extraParams['action_report'] ?? '無事フォローが完了しました。',
            '{{本日期限件数}}' => (string)$todayDueCount,
            '{{本日期限タスクテーブルHTML}}' => $todayDueHtml,
            '{{本日期限タスクLINE一覧}}' => trim($todayDueLine),
            '{{参加予定日}}' => $extraParams['event_date'] ?? $meetingDateStr,
            '{{ダッシュボードURL}}' => "{$origin}/#dashboard",
            '{{アクション管理URL}}' => "{$origin}/#actions",
            '{{カルテURL}}' => !empty($extraParams['visitor_id']) ? "{$origin}/#visitor/{$extraParams['visitor_id']}" : "{$origin}/#visitors"
        ];

        return array_merge($defaultContext, $extraParams);
    }

    /**
     * テンプレート文字列内の {{...}} プレースホルダーを置換
     */
    public function replacePlaceholders(string $templateText, array $context): string {
        return strtr($templateText, $context);
    }
}
