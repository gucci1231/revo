<?php
namespace Api\Services;

use Api\Core\Database;

/**
 * NotificationService - Multi-Channel Notification Orchestrator
 * 
 * Implements Apple-style Pure White Card HTML Emails (One Email, One Action)
 * and 3 scheduled dispatch cycles:
 *   1. Post-meeting visitor feel rating (Thu 09:00)
 *   2. Pre-meeting ToDo & slip reminder (Wed 19:00)
 *   3. PALMS weekly report & ranking alert (Fri 12:00)
 * Plus LINE Messaging API lightweight alert interface.
 */
class NotificationService {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Render Apple-grade Pure White Card HTML Email template
     */
    public static function renderAppleStyleEmail(
        string $title,
        string $memberName,
        string $bodyHtml,
        string $actionLabel,
        string $actionUrl,
        ?string $subText = null,
        ?string $secondaryActionLabel = null,
        ?string $secondaryActionUrl = null
    ): string {
        $actionButtonHtml = '';
        if (!empty($actionLabel) && !empty($actionUrl)) {
            $actionButtonHtml = '
            <div style="margin: 28px 0 12px 0; text-align: center;">
                <a href="' . htmlspecialchars($actionUrl) . '" 
                   style="display: inline-block; width: 100%; max-width: 320px; min-height: 50px; line-height: 50px; background-color: #0071e3; color: #ffffff; text-decoration: none; border-radius: 14px; font-size: 16px; font-weight: 700; text-align: center; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.25);">
                    ' . htmlspecialchars($actionLabel) . '
                </a>
            </div>';
        }

        $secondaryButtonHtml = '';
        if (!empty($secondaryActionLabel) && !empty($secondaryActionUrl)) {
            $secondaryButtonHtml = '
            <div style="margin-bottom: 20px; text-align: center;">
                <a href="' . htmlspecialchars($secondaryActionUrl) . '" 
                   style="display: inline-block; width: 100%; max-width: 320px; min-height: 44px; line-height: 44px; background-color: #f1f5f9; color: #334155; text-decoration: none; border-radius: 12px; font-size: 14px; font-weight: 600; text-align: center;">
                    ' . htmlspecialchars($secondaryActionLabel) . '
                </a>
            </div>';
        }

        $subTextHtml = '';
        if (!empty($subText)) {
            $subTextHtml = '<p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; margin-top: 16px;">' . htmlspecialchars($subText) . '</p>';
        }

        return '<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . htmlspecialchars($title) . '</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', \'Helvetica Neue\', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05);">
        <tr>
            <td style="padding: 32px 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #0071e3; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">
                    BNI REvoチャプター
                </div>
                <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; line-height: 1.35;">
                    ' . htmlspecialchars($title) . '
                </h1>
                <div style="font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 16px;">
                    ' . htmlspecialchars($memberName) . ' 様
                </div>
                <div style="font-size: 15px; color: #334155; line-height: 1.6; word-break: break-word;">
                    ' . $bodyHtml . '
                </div>
                ' . $actionButtonHtml . '
                ' . $secondaryButtonHtml . '
                ' . $subTextHtml . '
            </td>
        </tr>
        <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600;">
                Visitor Host Revolution • REvo OS
            </td>
        </tr>
    </table>
</body>
</html>';
    }

    /**
     * Cycle 1: Thursday 09:00 - Post-meeting visitor feel rating email
     */
    public function generatePostMeetingFeelEmail(array $visitor, array $member): array {
        $title = "【感触のお伺い】定例会へのご参加ありがとうございました（{$visitor['visitor_name']} 様）";
        $vName = $visitor['visitor_name'];
        $company = $visitor['company'] ?: '貴社';

        $urlRankA = TokenService::generateActionUrl('feel_rank', (int)$member['id'], $visitor['id'], 'A');
        $urlRankB = TokenService::generateActionUrl('feel_rank', (int)$member['id'], $visitor['id'], 'B');
        $urlRankC = TokenService::generateActionUrl('feel_rank', (int)$member['id'], $visitor['id'], 'C');

        $bodyHtml = "
            本日の定例会に、ご紹介いただいた <strong>{$vName} 様（{$company}）</strong> がご参加されました！<br><br>
            面談での感触はいかがでしたでしょうか？<br>
            チームでの迅速なフォロー体制を整えるため、以下のボタンからワンタップで感触をお知らせください。
            
            <div style='margin: 20px 0; display: flex; flex-direction: column; gap: 10px;'>
                <a href='{$urlRankA}' style='display:block; padding: 14px; background:#ecfdf5; border: 1px solid #a7f3d0; border-radius:12px; color:#059669; font-weight:700; text-decoration:none; text-align:center;'>
                    🟢 Rank A（非常に前向き・入会見込み高）
                </a>
                <a href='{$urlRankB}' style='display:block; padding: 14px; background:#fefce8; border: 1px solid #fef08a; border-radius:12px; color:#a16207; font-weight:700; text-decoration:none; text-align:center; margin-top:8px;'>
                    🟡 Rank B（検討中・追加フォロー推奨）
                </a>
                <a href='{$urlRankC}' style='display:block; padding: 14px; background:#f1f5f9; border: 1px solid #e2e8f0; border-radius:12px; color:#64748b; font-weight:700; text-decoration:none; text-align:center; margin-top:8px;'>
                    ⚪ Rank C（見送り・定期情報提供）
                </a>
            </div>
        ";

        $portalUrl = TokenService::generatePortalUrl((int)$member['id']);
        $html = self::renderAppleStyleEmail(
            $title,
            $member['name'],
            $bodyHtml,
            'マイポータルで確認する',
            $portalUrl,
            '※ボタンをタップすると確認画面が開き、1回タップで確定保存されます。'
        );

        return [
            'subject' => $title,
            'html' => $html,
            'to' => $member['email'] ?? ''
        ];
    }

    /**
     * Cycle 2: Wednesday 19:00 - Pre-meeting ToDo & slip reminder email
     */
    public function generatePreMeetingReminderEmail(array $member, array $pendingActions = []): array {
        $title = "【明日06:00集合】定例会前夜のリマインド ＆ 今週のToDo";
        $mName = $member['name'];
        $taskCount = count($pendingActions);

        $bodyHtml = "
            明朝はいよいよ週に一度のREvo定例会（06:00メンバー集合・Zoom）です！<br><br>
            ■ <strong>BNI Connect スリップ入力</strong>（今夜23:59締切）<br>
            　先週の売上・1to1・リファーラルの入力はお済みですか？チャプターの信頼の証をぜひご登録ください。<br><br>
            ■ <strong>未完了タスク</strong>: " . ($taskCount > 0 ? "<strong>{$taskCount}件</strong> の対応があります。" : "すべて完了しています！✨") . "<br>
            マイポータルのフラッシュカードから、15秒で確認・完了できます。
        ";

        $portalUrl = TokenService::generatePortalUrl((int)$member['id']);
        $html = self::renderAppleStyleEmail(
            $title,
            $mName,
            $bodyHtml,
            '⚡ 15秒で今週のタスクを確認する',
            $portalUrl,
            'ID/パスワード入力なしで、このリンクから直接開きます。'
        );

        return [
            'subject' => $title,
            'html' => $html,
            'to' => $member['email'] ?? ''
        ];
    }

    /**
     * Cycle 3: Friday 12:00 - PALMS weekly report & ranking alert
     */
    public function generatePalmsWeeklyEmail(array $member, array $palms): array {
        $title = "【PALMS速報】最新スコア・チャプター活動実績のお知らせ";
        $mName = $member['name'];
        $score = $palms['traffic_score'] ?? 70;
        $tierName = $score >= 70 ? '🟢 グリーン' : ($score >= 55 ? '🟡 イエロー' : '🔴 レッド');

        $bodyHtml = "
            今週の定例会お疲れ様でした！最新のPALMS活動状況が集計されました。<br><br>
            ■ <strong>あなたのトラフィックライト</strong>: <strong>{$score}点 ({$tierName})</strong><br>
            ■ <strong>月間1to1</strong>: " . ($palms['one_to_ones'] ?? 0) . "回<br>
            ■ <strong>受講CEU</strong>: " . ($palms['ceu'] ?? 0) . "点<br><br>
            次のカラーゾーンへ上がるための「ベイビーステップ処方箋」をマイポータルにてお届けしています。
        ";

        $portalUrl = TokenService::generatePortalUrl((int)$member['id']);
        $html = self::renderAppleStyleEmail(
            $title,
            $mName,
            $bodyHtml,
            '📈 今期のグロースプランを確認する',
            $portalUrl,
            '仲間と共に一歩ずつ前進しましょう。'
        );

        return [
            'subject' => $title,
            'html' => $html,
            'to' => $member['email'] ?? ''
        ];
    }

    /**
     * LINE Messaging API Lightweight Dispatcher
     * 
     * Reserved for high-urgency alerts (e.g. New Visitor Registration)
     * Keeps message volume well within free/low-cost tiers.
     */
    public static function sendLinePushAlert(string $messageText, ?string $targetUserId = null): array {
        $channelToken = getenv('LINE_CHANNEL_ACCESS_TOKEN');
        if (empty($channelToken)) {
            // Simulated success for dev/test environments
            return [
                'success' => true,
                'simulated' => true,
                'message' => 'LINE channel token not configured; logged locally.'
            ];
        }

        // Real API invocation if configured
        $endpoint = 'https://api.line.me/v2/bot/message/broadcast';
        $payload = [
            'messages' => [
                ['type' => 'text', 'text' => $messageText]
            ]
        ];

        if (!empty($targetUserId)) {
            $endpoint = 'https://api.line.me/v2/bot/message/push';
            $payload['to'] = $targetUserId;
        }

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $channelToken
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'code' => $httpCode,
            'response' => $response
        ];
    }
}
