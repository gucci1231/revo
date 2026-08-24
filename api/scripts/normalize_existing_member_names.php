<?php
/**
 * 既存データベース内のメンバー名（紹介者・担当者・報告者）一括正規化スクリプト
 */
require_once __DIR__ . '/../bootstrap.php';

use Api\Core\Database;
use Api\Repositories\MemberRepository;
use Api\Services\MemberNameResolver;

echo "=== メンバー名 一括正規化スクリプト 開始 ===\n";

$db = Database::getConnection();
$memberRepo = new MemberRepository();
$members = $memberRepo->getAll();

echo "名簿メンバー数: " . count($members) . "\n\n";

$totalUpdated = 0;

// 1. visitors テーブルの inviter
echo "--- 1. visitors.inviter の確認・更新 ---\n";
$stmt = $db->query("SELECT id, inviter FROM visitors WHERE inviter IS NOT NULL AND inviter != ''");
$visitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updateVisitorStmt = $db->prepare("UPDATE visitors SET inviter = :inviter WHERE id = :id");
$vCount = 0;

foreach ($visitors as $v) {
    $raw = $v['inviter'];
    $resolved = MemberNameResolver::resolve($raw, $members);
    if ($raw !== $resolved) {
        $updateVisitorStmt->execute([':inviter' => $resolved, ':id' => $v['id']]);
        echo "  [Visitor ID: {$v['id']}] '{$raw}' -> '{$resolved}'\n";
        $vCount++;
    }
}
echo "  visitors 更新件数: {$vCount} 件\n\n";
$totalUpdated += $vCount;

// 2. hearing_sheets テーブルの orient_user
echo "--- 2. hearing_sheets.orient_user の確認・更新 ---\n";
$stmt = $db->query("SELECT visitor_id, orient_user FROM hearing_sheets WHERE orient_user IS NOT NULL AND orient_user != ''");
$hearings = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updateHearingStmt = $db->prepare("UPDATE hearing_sheets SET orient_user = :orient_user WHERE visitor_id = :visitor_id");
$hCount = 0;

foreach ($hearings as $h) {
    $raw = $h['orient_user'];
    $resolved = MemberNameResolver::resolve($raw, $members);
    if ($raw !== $resolved) {
        $updateHearingStmt->execute([':orient_user' => $resolved, ':visitor_id' => $h['visitor_id']]);
        echo "  [Hearing VisitorID: {$h['visitor_id']}] '{$raw}' -> '{$resolved}'\n";
        $hCount++;
    }
}
echo "  hearing_sheets 更新件数: {$hCount} 件\n\n";
$totalUpdated += $hCount;

// 3. action_plans テーブルの assignee_name / reporter_name
echo "--- 3. action_plans.assignee_name / reporter_name の確認・更新 ---\n";
$stmt = $db->query("SELECT id, assignee_name, reporter_name FROM action_plans");
$plans = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updatePlanStmt = $db->prepare("UPDATE action_plans SET assignee_name = :assignee_name, reporter_name = :reporter_name WHERE id = :id");
$pCount = 0;

foreach ($plans as $p) {
    $rawAssignee = $p['assignee_name'] ?? '';
    $rawReporter = $p['reporter_name'] ?? '';

    $resolvedAssignee = $rawAssignee ? MemberNameResolver::resolve($rawAssignee, $members) : $rawAssignee;
    $resolvedReporter = $rawReporter ? MemberNameResolver::resolve($rawReporter, $members) : $rawReporter;

    if ($rawAssignee !== $resolvedAssignee || $rawReporter !== $resolvedReporter) {
        $updatePlanStmt->execute([
            ':assignee_name' => $resolvedAssignee,
            ':reporter_name' => $resolvedReporter,
            ':id' => $p['id']
        ]);
        echo "  [ActionPlan ID: {$p['id']}] Assignee: '{$rawAssignee}' -> '{$resolvedAssignee}', Reporter: '{$rawReporter}' -> '{$resolvedReporter}'\n";
        $pCount++;
    }
}
echo "  action_plans 更新件数: {$pCount} 件\n\n";
$totalUpdated += $pCount;

echo "=== 一括正規化 完了: 合計 {$totalUpdated} 件 更新 ===\n";
