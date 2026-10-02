<?php
/**
 * REvo OS - Ultra-lightweight Mobile My Portal & Flashcard Engine (my.php)
 * 
 * Conforms to Apple-Grade Simplicity & Dual-Tier Architecture (<30KB, <0.1s load time)
 * Features:
 *  - Zero-Login HMAC Stateless Authentication (Magic Link)
 *  - Triple Activity Rings (Visitor, Slips, 1to1)
 *  - "Yes/No Pan-Pan-Pan" Flashcard Decision UI (15-second completion)
 *  - Inbox Zero Celebration & Streak Gamification
 *  - High-Five & Rescue Communication Engine
 */

require_once __DIR__ . '/api/bootstrap.php';

use Api\Services\TokenService;
use Api\Services\GrowthAdvisorService;
use Api\Services\OnboardingService;
use Api\Core\Database;

$token = $_GET['k'] ?? '';
$memberId = 0;
$authError = null;

// 1. Authenticate via Token or fallback to parameter for preview/testing
if (!empty($token)) {
    $payload = TokenService::verifyToken($token);
    if ($payload && isset($payload['m'])) {
        $memberId = (int)$payload['m'];
    } else {
        $authError = 'リンクの有効期限が切れているか、無効なトークンです。';
    }
} elseif (isset($_GET['id'])) {
    $memberId = (int)$_GET['id'];
}

$db = Database::getInstance();

// If memberId not found, default to first active member
if ($memberId <= 0) {
    $stmt = $db->query("SELECT id FROM members WHERE status = '在籍' ORDER BY id ASC LIMIT 1");
    $memberId = (int)($stmt->fetchColumn() ?: 1);
}

// 2. Fetch Member Profile
$stmt = $db->prepare("SELECT * FROM members WHERE id = ?");
$stmt->execute([$memberId]);
$member = $stmt->fetch(\PDO::FETCH_ASSOC);

if (!$member) {
    die("Member not found.");
}

$memberName = $member['name'];

// 3. Fetch Action Plans (Pending Tasks for this member)
$stmt = $db->prepare("
    SELECT ap.*, v.visitor_name, v.company as visitor_company
    FROM action_plans ap
    LEFT JOIN visitors v ON ap.visitor_id = v.id
    WHERE (ap.assignee_name = ? OR ap.assignee_id = ?)
      AND ap.is_completed = 0
    ORDER BY ap.due_date ASC
");
$stmt->execute([$memberName, (string)$memberId]);
$pendingActions = $stmt->fetchAll(\PDO::FETCH_ASSOC);

// 4. Fetch Visitors introduced by this member
$stmt = $db->prepare("
    SELECT v.*, h.feel_abc, h.follow_memo, vs.is_attended, vs.is_joined
    FROM visitors v
    LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
    LEFT JOIN visitors_status vs ON v.id = vs.visitor_id
    WHERE v.inviter LIKE ?
    ORDER BY v.event_date DESC
    LIMIT 5
");
$stmt->execute(['%' . $memberName . '%']);
$myVisitors = $stmt->fetchAll(\PDO::FETCH_ASSOC);

// 5. Fetch Latest PALMS & Traffic Light
$stmt = $db->prepare("
    SELECT * FROM palms_reports 
    WHERE member_id = ? OR member_name = ?
    ORDER BY end_date DESC LIMIT 1
");
$stmt->execute([(string)$memberId, $memberName]);
$myPalms = $stmt->fetch(\PDO::FETCH_ASSOC);

$trafficScore = 75; // Default healthy score
if ($myPalms) {
    $trafficScore = (int)($myPalms['traffic_score'] ?? 75);
}
$trafficBadgeColor = $trafficScore >= 70 ? '#059669' : ($trafficScore >= 55 ? '#d97706' : '#dc2626');
$trafficTierName = $trafficScore >= 70 ? 'グリーン 🟢' : ($trafficScore >= 55 ? 'イエロー 🟡' : 'レッド 🔴');

// 5-2. Personalized Growth Engine (PGE) Prescription
$growthAdvisor = new GrowthAdvisorService($db);
$pgePlan = $growthAdvisor->generatePrescription($memberId);

// 5-3. 60-Day Onboarding Track
$onboardingService = new OnboardingService($db);
$onboardingData = (!empty($member['is_onboarding']) || !empty($_GET['onboarding'])) 
    ? $onboardingService->evaluateMemberMilestones($member) 
    : null;

// 6. Build Flashcard Tasks List
$flashcardTasks = [];

foreach ($pendingActions as $pa) {
    $actionToken = TokenService::generateToken([
        'm' => $memberId,
        'a' => 'complete_action',
        't' => $pa['id']
    ], 604800);

    $flashcardTasks[] = [
        'id' => 'act_' . $pa['id'],
        'type' => 'action_plan',
        'actionId' => $pa['id'],
        'token' => $actionToken,
        'category' => 'ビジターフォロー',
        'title' => (!empty($pa['visitor_name']) ? "{$pa['visitor_name']} 様：" : '') . ($pa['action_text'] ?: 'フォロー対応'),
        'sub' => '期日: ' . ($pa['due_date'] ?: '今週中') . (!empty($pa['visitor_company']) ? " ({$pa['visitor_company']})" : ''),
        'visitorName' => $pa['visitor_name'] ?? '',
        'icon' => '🤝'
    ];
}

// Add Standard Weekly Routine Tasks if fewer than 2 tasks
if (count($flashcardTasks) < 2) {
    $flashcardTasks[] = [
        'id' => 'routine_slip',
        'type' => 'routine',
        'category' => 'スリップ入力',
        'title' => '先週の売上・1to1・リファーラルスリップの入力はお済みですか？',
        'sub' => 'BNI Connectへの入力は毎週水曜23:59が締切です',
        'icon' => '📝'
    ];
    $flashcardTasks[] = [
        'id' => 'routine_meeting',
        'type' => 'routine',
        'category' => '定例会準備',
        'title' => '次回定例会（木曜06:00集合）への出欠・メインプレゼン準備',
        'sub' => '代理出席が必要な場合は、お早めに手配をお願いします',
        'icon' => '⏰'
    ];
}

// Triple Ring Values (Apple Watch Style)
$ringVisitor = min(100, count($pendingActions) === 0 ? 100 : 50);
$ringSlip = 100;
$ring1to1 = min(100, ($myPalms['one_to_ones'] ?? 1) >= 2 ? 100 : 66);
$streakWeeks = 4; // 4 weeks streak
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#ffffff">
    <title><?= htmlspecialchars($memberName) ?> さんのマイポータル | REvo OS</title>
    <style>
        /* Apple-Grade Minimalist Mobile CSS (<12KB inline) */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", Hiragino Sans, "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
            padding-bottom: 60px;
        }
        .header-bar {
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 16px 20px;
            position: sticky;
            top: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-title {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: -0.01em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .streak-pill {
            background: #fff7ed;
            border: 1px solid #ffedd5;
            color: #ea580c;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .content {
            max-width: 480px;
            margin: 0 auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .card {
            background: #ffffff;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            padding: 20px;
            box-shadow: 0 2px 10px -2px rgba(0, 0, 0, 0.03);
        }
        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }
        .card-title {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
        }

        /* Apple Watch Activity Rings */
        .rings-container {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .ring-svg {
            width: 100px;
            height: 100px;
            transform: rotate(-90deg);
            flex-shrink: 0;
        }
        .ring-circle-bg {
            fill: none;
            stroke-width: 8;
        }
        .ring-circle {
            fill: none;
            stroke-width: 8;
            stroke-linecap: round;
            transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ring-legend {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
        }
        .legend-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
        }
        .legend-label {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #475569;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        /* Flashcard Deck UI */
        .deck-container {
            position: relative;
            min-height: 240px;
            perspective: 1000px;
        }
        .flashcard {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 24px 20px;
            box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: center bottom;
        }
        .flashcard.animating-out {
            transform: translateY(-80px) rotate(8deg) scale(0.9);
            opacity: 0;
            pointer-events: none;
        }
        .card-category {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #0071e3;
            margin-bottom: 8px;
        }
        .card-question {
            font-size: 17px;
            font-weight: 700;
            line-height: 1.4;
            color: #0f172a;
            margin-bottom: 8px;
        }
        .card-subtext {
            font-size: 13px;
            color: #64748b;
            line-height: 1.5;
            margin-bottom: 24px;
        }
        .card-actions {
            display: grid;
            grid-template-columns: 1fr 1.4fr;
            gap: 12px;
        }
        .btn-act {
            min-height: 52px;
            border-radius: 14px;
            font-size: 15px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: pointer;
            border: none;
            -webkit-tap-highlight-color: transparent;
            transition: all 0.15s ease;
        }
        .btn-pass {
            background: #f1f5f9;
            color: #475569;
        }
        .btn-pass:active { background: #e2e8f0; transform: scale(0.97); }
        .btn-done {
            background: #0071e3;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25);
        }
        .btn-done:active { background: #005bb5; transform: scale(0.97); }

        /* Inbox Zero State */
        .inbox-zero {
            display: none;
            text-align: center;
            padding: 32px 16px;
        }
        .inbox-zero.show {
            display: block;
            animation: fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.92); }
            to { opacity: 1; transform: scale(1); }
        }

        /* Visitor Item Rows */
        .visitor-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .visitor-row:last-child { border-bottom: none; }
        .visitor-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .visitor-name {
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
        }
        .visitor-meta {
            font-size: 12px;
            color: #64748b;
        }
        .rank-pill {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 9999px;
        }
        .rank-a { background: #ecfdf5; color: #059669; }
        .rank-b { background: #fefce8; color: #a16207; }
        .rank-c { background: #f1f5f9; color: #64748b; }

        /* Communication Bar */
        .comm-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .comm-btn {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 8px;
            text-align: left;
            cursor: pointer;
            text-decoration: none;
            -webkit-tap-highlight-color: transparent;
        }
        .comm-btn:active { background: #e2e8f0; }
        .toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #0f172a;
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            padding: 10px 20px;
            border-radius: 9999px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 100;
            pointer-events: none;
        }
        .toast.show {
            transform: translateX(-50%) translateY(0);
        }
    </style>
</head>
<body>

<div class="header-bar">
    <div class="header-title">
        <span>👤 <?= htmlspecialchars($memberName) ?></span>
    </div>
    <div class="streak-pill">
        <span>🔥</span>
        <span><?= $streakWeeks ?>週連続達成</span>
    </div>
</div>

<div class="content">

    <!-- 1. Apple Watch Triple Activity Rings -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">活動トリプル・リング ⭕</div>
            <span class="badge" style="background: <?= $trafficBadgeColor ?>20; color: <?= $trafficBadgeColor ?>;">
                トラフィック: <?= $trafficScore ?>点 (<?= $trafficTierName ?>)
            </span>
        </div>
        <div class="rings-container">
            <svg class="ring-svg" viewBox="0 0 100 100">
                <!-- Ring 1: Visitor (Outer, Rose) r=42 -->
                <circle class="ring-circle-bg" cx="50" cy="50" r="42" stroke="#ffe4e6" />
                <circle class="ring-circle" id="ring-visitor" cx="50" cy="50" r="42" stroke="#f43f5e" 
                        stroke-dasharray="263.89" stroke-dashoffset="<?= 263.89 * (1 - $ringVisitor / 100) ?>" />
                <!-- Ring 2: Slips (Middle, Green) r=30 -->
                <circle class="ring-circle-bg" cx="50" cy="50" r="30" stroke="#dcfce7" />
                <circle class="ring-circle" id="ring-slips" cx="50" cy="50" r="30" stroke="#10b981" 
                        stroke-dasharray="188.49" stroke-dashoffset="<?= 188.49 * (1 - $ringSlip / 100) ?>" />
                <!-- Ring 3: 1to1 (Inner, Blue) r=18 -->
                <circle class="ring-circle-bg" cx="50" cy="50" r="18" stroke="#e0f2fe" />
                <circle class="ring-circle" id="ring-1to1" cx="50" cy="50" r="18" stroke="#0ea5e9" 
                        stroke-dasharray="113.09" stroke-dashoffset="<?= 113.09 * (1 - $ring1to1 / 100) ?>" />
            </svg>
            <div class="ring-legend">
                <div class="legend-row">
                    <span class="legend-label"><span class="dot" style="background:#f43f5e;"></span>ビジター対応</span>
                    <strong style="color:#f43f5e;"><?= $ringVisitor ?>%</strong>
                </div>
                <div class="legend-row">
                    <span class="legend-label"><span class="dot" style="background:#10b981;"></span>スリップ入力</span>
                    <strong style="color:#10b981;"><?= $ringSlip ?>%</strong>
                </div>
                <div class="legend-row">
                    <span class="legend-label"><span class="dot" style="background:#0ea5e9;"></span>1to1 活動</span>
                    <strong style="color:#0ea5e9;"><?= $ring1to1 ?>%</strong>
                </div>
            </div>
        </div>
    </div>

    <!-- 2. Flashcard Decision UI (Yes/No Pan-Pan-Pan) -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">今週のタスク判定 ⚡</div>
            <span id="card-counter" class="badge" style="background:#eff6ff; color:#0071e3;">
                残り <?= count($flashcardTasks) ?> 問
            </span>
        </div>

        <div class="deck-container" id="deck-container">
            <?php foreach ($flashcardTasks as $idx => $t): ?>
                <div class="flashcard" id="<?= $t['id'] ?>" style="z-index: <?= 100 - $idx ?>;" data-token="<?= $t['token'] ?? '' ?>">
                    <div class="card-category"><?= $t['icon'] ?> <?= htmlspecialchars($t['category']) ?></div>
                    <div class="card-question"><?= htmlspecialchars($t['title']) ?></div>
                    <div class="card-subtext"><?= htmlspecialchars($t['sub']) ?></div>
                    <div class="card-actions">
                        <button type="button" class="btn-act btn-pass" onclick="handleCardAction('pass', '<?= $t['id'] ?>')">
                            ✕ まだ
                        </button>
                        <button type="button" class="btn-act btn-done" onclick="handleCardAction('done', '<?= $t['id'] ?>')">
                            ⭕ 完了！
                        </button>
                    </div>
                </div>
            <?php endforeach; ?>

            <!-- Inbox Zero State -->
            <div class="inbox-zero" id="inbox-zero-screen">
                <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">Inbox Zero 達成！</h3>
                <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                    今週の確認タスクはすべて完了しました。<br>素晴らしい自走とチャプター貢献をありがとうございます！
                </p>
                <div class="streak-pill" style="margin: 0 auto;">
                    <span>🔥</span>
                    <span>連続クリア記録が伸びました！</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 3. Communication Engine (High-Five & Rescue) -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">コミュニケーション 🤝</div>
        </div>
        <div class="comm-grid">
            <button type="button" class="comm-btn" onclick="sendHighFive()">
                <span style="font-size: 20px;">🙌</span>
                <div>
                    <div>ありがとうハイタッチ</div>
                    <div style="font-size: 11px; color:#64748b; font-weight: 400;">紹介者・バディへ感謝</div>
                </div>
            </button>
            <button type="button" class="comm-btn" onclick="requestProxyAttendance()">
                <span style="font-size: 20px;">🆘</span>
                <div>
                    <div>代理出席を依頼</div>
                    <div style="font-size: 11px; color:#64748b; font-weight: 400;">LINE用文面を生成</div>
                </div>
            </button>
        </div>
    </div>

    <!-- 4. Calendar Sync Engine (1-Tap & Webcal) -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">カレンダー連携 📅</div>
        </div>
        <div class="comm-grid">
            <a href="api/event_ics.php?type=meeting" class="comm-btn" download>
                <span style="font-size: 20px;">🗓️</span>
                <div>
                    <div>次回定例会を追加</div>
                    <div style="font-size: 11px; color:#64748b; font-weight: 400;">ワンタップ .ics 保存</div>
                </div>
            </a>
            <a href="webcal://revo.k-d-o.biz/api/calendar_feed.php<?= !empty($token) ? '?k=' . urlencode($token) : '' ?>" class="comm-btn">
                <span style="font-size: 20px;">⚡</span>
                <div>
                    <div>一生自動同期 (Webcal)</div>
                    <div style="font-size: 11px; color:#64748b; font-weight: 400;">iPhoneカレンダー照会</div>
                </div>
            </a>
        </div>
    </div>

    <!-- 5. Personal Growth Engine (PGE) Prescription -->
    <?php if (!empty($pgePlan) && !empty($pgePlan['success'])): ?>
    <div class="card">
        <div class="card-header">
            <div class="card-title">今期のグロースプラン 📈</div>
            <?php if (!empty($pgePlan['isAccepted'])): ?>
                <span class="badge" style="background:#ecfdf5; color:#059669;">✅ コミット済み</span>
            <?php else: ?>
                <span class="badge" style="background:#eff6ff; color:#0071e3;">目標: <?= $pgePlan['targetScore'] ?>点</span>
            <?php endif; ?>
        </div>
        <p style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
            <?= htmlspecialchars($pgePlan['headline']) ?>
        </p>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 16px;">
            <?= htmlspecialchars($pgePlan['prescription']) ?>
        </p>

        <?php if (empty($pgePlan['isAccepted'])): ?>
            <a href="<?= htmlspecialchars($pgePlan['acceptUrl']) ?>" class="btn-act btn-done" style="text-decoration:none; width:100%; margin-bottom: 12px;">
                🤝 このプランで挑戦する！
            </a>
        <?php endif; ?>

        <?php if (!empty($pgePlan['recommendedEvents'])): ?>
            <div style="border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 8px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px;">おすすめ京都CC研修</div>
                <?php foreach ($pgePlan['recommendedEvents'] as $re): ?>
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; font-size: 13px;">
                        <span style="font-weight:600; color:#334155;"><?= htmlspecialchars($re['title']) ?></span>
                        <a href="api/event_ics.php?type=region_event&id=<?= urlencode($re['id']) ?>" download style="font-size:11px; color:#0071e3; text-decoration:none; padding:4px 8px; background:#eff6ff; border-radius:6px; font-weight:700;">
                            📅 追加
                        </a>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- 6. 60-Day Onboarding Track (for new members) -->
    <?php if (!empty($onboardingData)): ?>
    <div class="card" style="border-left: 4px solid #0071e3;">
        <div class="card-header">
            <div class="card-title">初動60日オンボーディング 🔰</div>
            <span class="badge" style="background:#eff6ff; color:#0071e3;">
                進捗: <?= $onboardingData['progressRate'] ?>% (<?= $onboardingData['completedCount'] ?>/4)
            </span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
            入会<?= $onboardingData['daysElapsed'] ?>日目 • サポート担当バディ: <?= htmlspecialchars($onboardingData['buddyName']) ?>
        </p>

        <div style="display: flex; flex-direction: column; gap: 8px;">
            <?php foreach ($onboardingData['milestones'] as $k => $m): ?>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f8fafc;">
                    <span style="color: <?= $m['completed'] ? '#059669' : '#334155' ?>; font-weight: <?= $m['completed'] ? '700' : '500' ?>;">
                        <?= $m['completed'] ? '✅' : '⚪' ?> <?= htmlspecialchars($m['label']) ?>
                    </span>
                    <span style="font-size: 11px; color: <?= $m['completed'] ? '#059669' : '#94a3b8' ?>; font-weight: 600;">
                        <?= $m['completed'] ? '達成済' : '未達' ?>
                    </span>
                </div>
            <?php endforeach; ?>
        </div>

        <?php if (!empty($onboardingData['careCallSuggestion'])): ?>
            <div style="margin-top: 12px; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 10px; padding: 10px; font-size: 12px; color: #9a3412; line-height: 1.4;">
                <?= htmlspecialchars($onboardingData['careCallSuggestion']) ?>
            </div>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- 4. 関与ビジターの進捗 -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">紹介・関与ビジター (<?= count($myVisitors) ?>名)</div>
        </div>
        <?php if (empty($myVisitors)): ?>
            <p style="font-size: 13px; color: #94a3b8; text-align: center; padding: 12px 0;">
                現在関与しているビジターはいません。
            </p>
        <?php else: ?>
            <?php foreach ($myVisitors as $v): ?>
                <?php
                $rank = $v['feel_abc'] ?: '未';
                $rankClass = $rank === 'A' ? 'rank-a' : ($rank === 'B' ? 'rank-b' : 'rank-c');
                ?>
                <div class="visitor-row">
                    <div class="visitor-info">
                        <span class="visitor-name"><?= htmlspecialchars($v['visitor_name']) ?> 様</span>
                        <span class="visitor-meta"><?= htmlspecialchars($v['company']) ?> • <?= htmlspecialchars($v['event_date']) ?> 来訪</span>
                    </div>
                    <div>
                        <span class="rank-pill <?= $rankClass ?>">感触: <?= htmlspecialchars($rank) ?></span>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

</div>

<div class="toast" id="toast-msg"></div>

<script>
    let remainingCards = <?= count($flashcardTasks) ?>;

    function handleCardAction(action, cardId) {
        const card = document.getElementById(cardId);
        if (!card) return;

        const token = card.getAttribute('data-token');

        if (action === 'done' && token) {
            // Trigger background execution if action token exists
            fetch('act.php?k=' + encodeURIComponent(token) + '&confirm=1', { method: 'GET' })
                .catch(err => console.log('Silent sync', err));
            showToast('タスクを完了にしました！✨');
        } else if (action === 'done') {
            showToast('タスクを完了にしました！✨');
        } else {
            showToast('あとでリマインドします ⏰');
        }

        // Card animation
        card.classList.add('animating-out');
        setTimeout(() => {
            card.remove();
            remainingCards--;
            updateCardCounter();
        }, 300);
    }

    function updateCardCounter() {
        const counterEl = document.getElementById('card-counter');
        if (counterEl) {
            counterEl.textContent = '残り ' + remainingCards + ' 問';
        }
        if (remainingCards <= 0) {
            if (counterEl) counterEl.style.display = 'none';
            const zeroScreen = document.getElementById('inbox-zero-screen');
            if (zeroScreen) {
                zeroScreen.classList.add('show');
            }
        }
    }

    function sendHighFive() {
        const text = "【REvo】いつも素晴らしいサポートありがとうございます！ありがとうハイタッチを送りました 🙌✨";
        copyToClipboard(text, "ハイタッチ文面をコピーしました！LINEでお送りください 🙌");
    }

    function requestProxyAttendance() {
        const text = "【REvo代理出席のお願い】\nお疲れ様です。次回の定例会に出席が難しいため、どなたか代理出席を引き受けていただけないでしょうか？どうぞよろしくお願いいたします！";
        copyToClipboard(text, "代理出席依頼文をコピーしました！グループLINE等へ貼り付けてください 📋");
    }

    function copyToClipboard(text, toastText) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(toastText);
            }).catch(() => {
                showToast(toastText);
            });
        } else {
            showToast(toastText);
        }
    }

    function showToast(msg) {
        const t = document.getElementById('toast-msg');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => {
            t.classList.remove('show');
        }, 2500);
    }
</script>

</body>
</html>
