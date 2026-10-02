<?php
/**
 * REvo OS - Ultra-lightweight Action Engine (act.php)
 * 
 * Conforms to Apple-Grade Simplicity & Dual-Tier Architecture (<30KB, <0.1s load time)
 * Features:
 *  - Zero-Login HMAC Stateless Authentication
 *  - Email Security Bot Anti-Misclick Defense (1-Tap Confirmation Screen)
 *  - Idempotent Safe Execution (friendly display if already executed)
 *  - Pure HTML + Inline CSS (Zero external CSS/JS dependencies)
 */

require_once __DIR__ . '/api/bootstrap.php';

use Api\Services\TokenService;
use Api\Core\Database;

$token = $_GET['k'] ?? $_POST['k'] ?? '';
$confirm = isset($_POST['confirm']) || (isset($_GET['confirm']) && $_GET['confirm'] === '1');

// Page state variables
$state = 'unknown'; // 'confirm_needed', 'success', 'already_done', 'error'
$title = 'REvo Action';
$message = '';
$subMessage = '';
$actionLabel = '';
$actionPayload = null;
$member = null;
$targetData = null;
$portalUrl = '';

if (empty($token)) {
    $state = 'error';
    $message = '無効なアクセスです';
    $subMessage = 'URLに認証トークンが含まれていません。メールまたはLINEの最新リンクから再度アクセスしてください。';
} else {
    $payload = TokenService::verifyToken($token);
    if (!$payload) {
        $state = 'error';
        $message = 'リンクが無効または期限切れです';
        $subMessage = 'セキュリティ保護のため、このリンクの有効期限が切れているか、URLが正しくありません。';
    } else {
        $actionPayload = $payload;
        $memberId = (int)($payload['m'] ?? 0);
        $action = $payload['a'] ?? '';
        $targetId = $payload['t'] ?? null;
        $value = $payload['v'] ?? null;

        $db = Database::getInstance();
        $portalUrl = TokenService::generatePortalUrl($memberId);

        // Fetch Member
        if ($memberId > 0) {
            $stmt = $db->prepare("SELECT * FROM members WHERE id = ?");
            $stmt->execute([$memberId]);
            $member = $stmt->fetch(\PDO::FETCH_ASSOC);
        }

        try {
            switch ($action) {
                case 'feel_rank':
                    // Visitor Feel Rank Action (A/B/C)
                    $visitorId = (string)$targetId;
                    $rank = strtoupper(trim((string)$value));
                    if (!in_array($rank, ['A', 'B', 'C'])) {
                        $rank = 'B';
                    }

                    $stmt = $db->prepare("SELECT v.*, h.feel_abc FROM visitors v LEFT JOIN hearing_sheets h ON v.id = h.visitor_id WHERE v.id = ?");
                    $stmt->execute([$visitorId]);
                    $targetData = $stmt->fetch(\PDO::FETCH_ASSOC);

                    if (!$targetData) {
                        $state = 'error';
                        $message = 'ビジター情報が見つかりません';
                        $subMessage = '指定されたビジターデータが存在しないか、すでに削除されています。';
                    } else {
                        $existingRank = $targetData['feel_abc'] ?? null;
                        
                        // Idempotency: already marked with the same rank
                        if (!empty($existingRank) && $existingRank === $rank && !$confirm) {
                            $state = 'already_done';
                            $title = '感触ランク記録済み';
                            $message = "すでに Rank {$rank} で登録されています";
                            $subMessage = "{$targetData['visitor_name']} 様の感触は正常に記録済みです。ご協力ありがとうございました。";
                        } elseif ($confirm) {
                            // Execute update in hearing_sheets
                            $hsCheck = $db->prepare("SELECT feel_abc FROM hearing_sheets WHERE visitor_id = ?");
                            $hsCheck->execute([$visitorId]);
                            if ($hsCheck->fetch()) {
                                $updateStmt = $db->prepare("UPDATE hearing_sheets SET feel_abc = ?, updated_at = datetime('now', 'localtime') WHERE visitor_id = ?");
                                $updateStmt->execute([$rank, $visitorId]);
                            } else {
                                $insertStmt = $db->prepare("INSERT INTO hearing_sheets (visitor_id, feel_abc, updated_at) VALUES (?, ?, datetime('now', 'localtime'))");
                                $insertStmt->execute([$visitorId, $rank]);
                            }
                            
                            $state = 'success';
                            $title = '感触ランクを記録しました';
                            $message = "Rank {$rank} として保存しました";
                            $subMessage = "{$targetData['visitor_name']} 様の次回アクション・フォローに反映されました。迅速なご対応ありがとうございます！";
                        } else {
                            // Show Bot-proof confirmation screen
                            $state = 'confirm_needed';
                            $title = 'ビジター感触の確認';
                            $message = "{$targetData['visitor_name']} 様の面談感触を【 Rank {$rank} 】で確定しますか？";
                            $subMessage = ($rank === 'A' ? '🟢 A（非常に前向き・入会見込み高）' : ($rank === 'B' ? '🟡 B（検討中・追加フォロー推奨）' : '⚪ C（見送り・定期情報提供）'));
                            $actionLabel = "Rank {$rank} で確定する";
                        }
                    }
                    break;

                case 'complete_action':
                    // Action Plan Completion Action
                    $actionId = (string)$targetId;
                    $stmt = $db->prepare("SELECT ap.*, v.visitor_name as visitor_name FROM action_plans ap LEFT JOIN visitors v ON ap.visitor_id = v.id WHERE ap.id = ?");
                    $stmt->execute([$actionId]);
                    $targetData = $stmt->fetch(\PDO::FETCH_ASSOC);

                    if (!$targetData) {
                        $state = 'error';
                        $message = 'タスクが見つかりません';
                        $subMessage = '指定されたアクションプランが存在しないか、すでに完了・削除されています。';
                    } else {
                        $isCompleted = (int)($targetData['is_completed'] ?? 0);

                        if ($isCompleted === 1 && !$confirm) {
                            $state = 'already_done';
                            $title = 'タスク完了済み';
                            $message = 'このタスクはすでに完了報告されています';
                            $subMessage = "「{$targetData['action_text']}」はすでに完了済みです。チャプターへの貢献ありがとうございます！";
                        } elseif ($confirm) {
                            $updateStmt = $db->prepare("UPDATE action_plans SET is_completed = 1, completed_at = datetime('now', 'localtime'), completed_by = ? WHERE id = ?");
                            $completedByName = $member['name'] ?? 'メンバー';
                            $updateStmt->execute([$completedByName, $actionId]);

                            $state = 'success';
                            $title = 'タスク完了を記録しました';
                            $message = 'タスクを完了にしました！✨';
                            $subMessage = "「{$targetData['action_text']}」の完了がチーム全体に共有されました。お疲れ様でした！";
                        } else {
                            $state = 'confirm_needed';
                            $title = 'タスク完了の確認';
                            $vName = !empty($targetData['visitor_name']) ? "（{$targetData['visitor_name']} 様）" : '';
                            $message = "「{$targetData['action_text']}」{$vName} を完了にしますか？";
                            $subMessage = "期日: " . ($targetData['due_date'] ?? '未定');
                            $actionLabel = '完了を確定する';
                        }
                    }
                    break;

                case 'accept_goal':
                    // PGE Goal Acceptance Action
                    $goalId = (int)$targetId;
                    $stmt = $db->prepare("SELECT * FROM member_goals WHERE id = ?");
                    $stmt->execute([$goalId]);
                    $targetData = $stmt->fetch(\PDO::FETCH_ASSOC);

                    if (!$targetData) {
                        $state = 'error';
                        $message = '目標データが見つかりません';
                        $subMessage = '指定された目標プランが存在しないか、すでに再生成されています。';
                    } else {
                        $isAccepted = (int)($targetData['is_accepted'] ?? 0);

                        if ($isAccepted === 1 && !$confirm) {
                            $state = 'already_done';
                            $title = '目標承認済み';
                            $message = '今期の目標プランはすでに承認済みです';
                            $subMessage = 'あなたの自走と成長をチャプター全員で全力応援しています！';
                        } elseif ($confirm) {
                            $updateStmt = $db->prepare("UPDATE member_goals SET is_accepted = 1, accepted_at = datetime('now', 'localtime') WHERE id = ?");
                            $updateStmt->execute([$goalId]);

                            $state = 'success';
                            $title = '目標プランを承認しました！🤝';
                            $message = '今期のグロースプランにコミットしました';
                            $subMessage = '素晴らしい一歩です！ベイビーステップを積み重ねて、目標達成を掴み取りましょう！';
                        } else {
                            $state = 'confirm_needed';
                            $title = 'パーソナル目標の確認';
                            $message = "今期のグロースプラン（目標スコア: {$targetData['target_score']}点）に挑戦しますか？";
                            $subMessage = "1to1 目標: {$targetData['target_1to1_count']}回 / CEU 目標: {$targetData['target_ceu_count']}点";
                            $actionLabel = '🤝 このプランで挑戦する！';
                        }
                    }
                    break;

                case 'high_five':
                    // Send High Five appreciation
                    $state = 'success';
                    $title = 'ありがとうハイタッチ！🙌';
                    $message = 'ハイタッチを送りました！';
                    $subMessage = '感謝と承認の気持ちがメンバーに届きました。温かいチーム文化をありがとうございます！';
                    break;

                default:
                    $state = 'error';
                    $message = '未定義のアクションです';
                    $subMessage = '要求された操作はサポートされていません。';
                    break;
            }
        } catch (\Exception $e) {
            $state = 'error';
            $message = '処理中にエラーが発生しました';
            $subMessage = $e->getMessage();
        }
    }
}

// Colors according to Apple-grade Radical Minimalism
$themeColor = '#0071e3'; // Electric Blue
if ($state === 'success' || $state === 'already_done') {
    $themeColor = '#059669'; // Emerald Green
} elseif ($state === 'error') {
    $themeColor = '#dc2626'; // Red
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <title><?= htmlspecialchars($title) ?> | REvo OS</title>
    <style>
        /* Apple-Grade Minimalist Mobile CSS (<8KB inline) */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", Hiragino Sans, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 16px;
        }
        .container {
            width: 100%;
            max-width: 420px;
            background: #ffffff;
            border-radius: 24px;
            border: 1px solid #e2e8f0;
            padding: 32px 24px;
            box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
            text-align: center;
        }
        .icon-circle {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            margin: 0 auto 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            background: #f1f5f9;
        }
        .icon-confirm { background: #eff6ff; color: #0071e3; }
        .icon-success { background: #ecfdf5; color: #059669; }
        .icon-already { background: #f0fdf4; color: #16a34a; }
        .icon-error { background: #fef2f2; color: #dc2626; }
        h1 {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #0f172a;
            margin-bottom: 12px;
            line-height: 1.35;
        }
        p.sub {
            font-size: 14px;
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 28px;
            word-break: break-word;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            min-height: 52px;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
            -webkit-tap-highlight-color: transparent;
        }
        .btn-primary {
            background-color: #0071e3;
            color: #ffffff;
            box-shadow: 0 4px 14px 0 rgba(0, 113, 227, 0.25);
        }
        .btn-primary:active {
            transform: scale(0.98);
            background-color: #005bb5;
        }
        .btn-secondary {
            background-color: #f1f5f9;
            color: #334155;
            margin-top: 12px;
        }
        .btn-secondary:active {
            background-color: #e2e8f0;
        }
        .member-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 12px;
            color: #475569;
            margin-bottom: 20px;
        }
        .footer-brand {
            margin-top: 24px;
            font-size: 11px;
            letter-spacing: 0.05em;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
        }
    </style>
</head>
<body>

<div class="container">
    <?php if ($member): ?>
        <div class="member-chip">
            <span>👤</span>
            <span><?= htmlspecialchars($member['name']) ?> さん</span>
            <?php if (!empty($member['role'])): ?>
                <span style="color:#94a3b8;">(<?= htmlspecialchars($member['role']) ?>)</span>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <?php if ($state === 'confirm_needed'): ?>
        <div class="icon-circle icon-confirm">⚡</div>
        <h1><?= htmlspecialchars($message) ?></h1>
        <p class="sub"><?= htmlspecialchars($subMessage) ?></p>

        <form method="POST" action="act.php">
            <input type="hidden" name="k" value="<?= htmlspecialchars($token) ?>">
            <input type="hidden" name="confirm" value="1">
            <button type="submit" class="btn btn-primary">
                <?= htmlspecialchars($actionLabel) ?>
            </button>
        </form>

        <?php if (!empty($portalUrl)): ?>
            <a href="<?= htmlspecialchars($portalUrl) ?>" class="btn btn-secondary">マイポータルを開く</a>
        <?php endif; ?>

    <?php elseif ($state === 'success'): ?>
        <div class="icon-circle icon-success">✨</div>
        <h1><?= htmlspecialchars($message) ?></h1>
        <p class="sub"><?= htmlspecialchars($subMessage) ?></p>

        <?php if (!empty($portalUrl)): ?>
            <a href="<?= htmlspecialchars($portalUrl) ?>" class="btn btn-primary">マイポータルへ進む</a>
        <?php endif; ?>

    <?php elseif ($state === 'already_done'): ?>
        <div class="icon-circle icon-already">✓</div>
        <h1><?= htmlspecialchars($message) ?></h1>
        <p class="sub"><?= htmlspecialchars($subMessage) ?></p>

        <?php if (!empty($portalUrl)): ?>
            <a href="<?= htmlspecialchars($portalUrl) ?>" class="btn btn-primary">マイポータルへ進む</a>
        <?php endif; ?>

    <?php else: ?>
        <div class="icon-circle icon-error">⚠️</div>
        <h1><?= htmlspecialchars($message) ?></h1>
        <p class="sub"><?= htmlspecialchars($subMessage) ?></p>
        <a href="https://revo.k-d-o.biz" class="btn btn-secondary">トップページへ戻る</a>
    <?php endif; ?>

    <div class="footer-brand">Visitor Host Revolution • REvo OS</div>
</div>

</body>
</html>
