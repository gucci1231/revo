<?php
/**
 * PALMS API Endpoint
 * Handles fetching PALMS rankings and triggering manual sync with BNI Connect.
 */
require_once __DIR__ . '/bootstrap.php';

use Api\Core\Database;
use Api\Services\BniConnectService;

header('Content-Type: application/json; charset=utf-8');

$db = Database::getInstance();
$pdo = $db->getPdo();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($method === 'POST' ? 'sync' : 'list');

try {
    if ($action === 'member') {
        $memberName = $_GET['name'] ?? null;
        $memberId = $_GET['member_id'] ?? null;
        if (!$memberName && !$memberId) {
            throw new Exception("Member name or ID is required");
        }

        $where = $memberId ? "p.member_id = :val" : "p.member_name = :val";
        $sql = "
            SELECT 
                p.*,
                (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) as total_referrals_given,
                (p.rri_referrals_received_internal + p.rro_referrals_received_external) as total_referrals_received,
                (p.tyfcb_amount * 1000) as tyfcb_yen,
                m.category as member_category,
                m.profession as member_profession
            FROM palms_reports p
            LEFT JOIN members m ON p.member_id = m.id
            WHERE {$where}
            ORDER BY p.end_date DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':val' => $memberId ?: $memberName]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $weekly = [];
        $terms = [];
        foreach ($history as $h) {
            $d1 = new \DateTime($h['start_date']);
            $d2 = new \DateTime($h['end_date']);
            $diffDays = $d1->diff($d2)->days + 1;
            if ($diffDays <= 14) {
                $weekly[] = $h;
            } else {
                $terms[] = $h;
            }
        }

        echo json_encode([
            'success' => true,
            'member' => $memberName ?: ($history[0]['member_name'] ?? ''),
            'history' => $history,
            'weekly' => $weekly,
            'terms' => $terms
        ]);
        exit;
    }

    if ($action === 'chapter_trends') {
        $stmtWeekly = $pdo->query("
            SELECT 
                start_date, end_date,
                SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
                SUM(one_to_ones) as total_oto,
                SUM(v_visitors) as total_visitors,
                SUM(tyfcb_amount * 1000) as total_tyfcb,
                COUNT(DISTINCT member_id) as member_count
            FROM palms_reports
            WHERE (julianday(end_date) - julianday(start_date)) <= 14
            GROUP BY start_date, end_date
            ORDER BY end_date ASC
        ");
        $weekly = $stmtWeekly->fetchAll(PDO::FETCH_ASSOC);

        $stmtTerms = $pdo->query("
            SELECT 
                start_date, end_date,
                SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
                SUM(one_to_ones) as total_oto,
                SUM(v_visitors) as total_visitors,
                SUM(tyfcb_amount * 1000) as total_tyfcb,
                COUNT(DISTINCT member_id) as member_count
            FROM palms_reports
            WHERE (julianday(end_date) - julianday(start_date)) > 60
            GROUP BY start_date, end_date
            ORDER BY start_date ASC
        ");
        $terms = $stmtTerms->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'weekly' => $weekly,
            'terms' => $terms
        ]);
        exit;
    }

    if ($action === 'periods') {
        $stmt = $pdo->query("
            SELECT DISTINCT start_date, end_date, COUNT(*) as member_count
            FROM palms_reports
            GROUP BY start_date, end_date
            ORDER BY end_date DESC
        ");
        $periods = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'periods' => $periods]);
        exit;
    }

    if ($action === 'sync') {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $startDate = $input['startDate'] ?? $_GET['startDate'] ?? null;
        $endDate = $input['endDate'] ?? $_GET['endDate'] ?? null;
        $weeksCount = isset($input['weeksCount']) ? (int)$input['weeksCount'] : (isset($_GET['weeksCount']) ? (int)$_GET['weeksCount'] : 0);

        $service = new BniConnectService($db);

        if ($weeksCount > 0) {
            $result = $service->syncRecentWeeks($weeksCount);
            echo json_encode([
                'success' => true,
                'message' => "直近{$weeksCount}週間のPALMSデータを正常に取得・更新しました（{$result['totalSaved']}件）",
                'data' => $result
            ]);
            exit;
        }

        if (!$startDate || !$endDate) {
            $range = BniConnectService::getDefaultWeeklyRange();
            $startDate = $range['startDate'];
            $endDate = $range['endDate'];
        }

        $result = $service->sync($startDate, $endDate);

        echo json_encode([
            'success' => true,
            'message' => "PALMSデータを正常に取得・更新しました（{$result['savedCount']}件）",
            'data' => $result
        ]);
        exit;
    }

    if ($action === 'list') {
        $startDate = $_GET['startDate'] ?? null;
        $endDate = $_GET['endDate'] ?? null;

        $params = [];
        $whereClause = "";

        if ($startDate && $endDate) {
            $whereClause = "WHERE start_date = :start_date AND end_date = :end_date";
            $params[':start_date'] = $startDate;
            $params[':end_date'] = $endDate;
        } else {
            // Default to the latest period available in DB
            $latestStmt = $pdo->query("
                SELECT start_date, end_date 
                FROM palms_reports 
                ORDER BY end_date DESC 
                LIMIT 1
            ");
            $latest = $latestStmt->fetch(PDO::FETCH_ASSOC);
            if ($latest) {
                $whereClause = "WHERE start_date = :start_date AND end_date = :end_date";
                $params[':start_date'] = $latest['start_date'];
                $params[':end_date'] = $latest['end_date'];
            }
        }

        $sql = "
            SELECT 
                p.*,
                (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) as total_referrals_given,
                (p.rri_referrals_received_internal + p.rro_referrals_received_external) as total_referrals_received,
                (p.tyfcb_amount * 1000) as tyfcb_yen,
                m.category as member_category,
                m.profession as member_profession
            FROM palms_reports p
            LEFT JOIN members m ON p.member_id = m.id
            {$whereClause}
            ORDER BY (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) DESC, p.one_to_ones DESC, p.v_visitors DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'period' => [
                'startDate' => $params[':start_date'] ?? null,
                'endDate' => $params[':end_date'] ?? null
            ],
            'totalMembers' => count($records),
            'records' => $records
        ]);
        exit;
    }

    throw new Exception("Unknown action '{$action}'");
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
