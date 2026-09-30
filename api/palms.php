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
            LEFT JOIN members m ON (p.member_name = m.name OR p.member_id = m.id)
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
                SUM(rgi_referrals_given_internal) as total_referrals_internal,
                SUM(rgo_referrals_given_external) as total_referrals_external,
                SUM(one_to_ones) as total_oto,
                SUM(v_visitors) as total_visitors,
                SUM(ceu) as total_ceu,
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
                SUM(rgi_referrals_given_internal) as total_referrals_internal,
                SUM(rgo_referrals_given_external) as total_referrals_external,
                SUM(one_to_ones) as total_oto,
                SUM(v_visitors) as total_visitors,
                SUM(ceu) as total_ceu,
                SUM(tyfcb_amount * 1000) as total_tyfcb,
                COUNT(DISTINCT member_id) as member_count
            FROM palms_reports
            WHERE (julianday(end_date) - julianday(start_date)) > 60
            GROUP BY start_date, end_date
            ORDER BY start_date ASC
        ");
        $terms = $stmtTerms->fetchAll(PDO::FETCH_ASSOC);

        // Fetch period groupings for 1 Month, 6 Months, and All Time achievements
        $stmtPeriods = $pdo->query("
            SELECT 
                start_date, end_date,
                CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER) as days_diff,
                SUM(tyfcb_amount * 1000) as tyfcb_yen,
                SUM(rgi_referrals_given_internal + rgo_referrals_given_external) as total_referrals,
                SUM(rgi_referrals_given_internal) as internal_referrals,
                SUM(rgo_referrals_given_external) as external_referrals,
                ROUND(CAST(SUM(rgo_referrals_given_external) AS FLOAT) / NULLIF(SUM(rgi_referrals_given_internal + rgo_referrals_given_external), 0) * 100, 1) as external_rate,
                SUM(v_visitors) as visitors,
                SUM(one_to_ones) as one_to_ones,
                SUM(ceu) as ceu,
                COUNT(DISTINCT member_id) as member_count
            FROM palms_reports
            GROUP BY start_date, end_date
            ORDER BY end_date DESC, days_diff ASC
        ");
        $allGroups = $stmtPeriods->fetchAll(PDO::FETCH_ASSOC);

        $oneMonthRaw = null;
        $sixMonthsRaw = null;
        $allTimeRaw = null;

        foreach ($allGroups as $row) {
            $diff = (int)$row['days_diff'];
            if ($diff >= 20 && $diff <= 45 && !$oneMonthRaw) {
                $oneMonthRaw = $row;
            }
            if ($diff >= 120 && $diff <= 210 && !$sixMonthsRaw) {
                $sixMonthsRaw = $row;
            }
            if ($diff >= 300 && !$allTimeRaw) {
                $allTimeRaw = $row;
            }
        }

        $formatPeriodData = function ($raw, $label) {
            if (!$raw) {
                return [
                    'label' => $label,
                    'period_label' => '--',
                    'start_date' => null,
                    'end_date' => null,
                    'tyfcb_yen' => 0,
                    'tyfcb_formatted' => '0 万円',
                    'total_referrals' => 0,
                    'internal_referrals' => 0,
                    'external_referrals' => 0,
                    'external_rate' => 0.0,
                    'visitors' => 0,
                    'one_to_ones' => 0,
                    'ceu' => 0,
                    'member_count' => 0
                ];
            }
            $yen = (float)($raw['tyfcb_yen'] ?? 0);
            $formattedTyfcb = '0 万円';
            if ($yen >= 100000000) {
                $formattedTyfcb = number_format($yen / 100000000, 2) . ' 億円';
            } elseif ($yen >= 10000) {
                $man = $yen / 10000;
                $formattedTyfcb = (floor($man) == $man ? number_format($man) : number_format($man, 1)) . ' 万円';
            } else {
                $formattedTyfcb = number_format($yen) . ' 円';
            }

            return [
                'label' => $label,
                'period_label' => ($raw['start_date'] ?? '') . ' 〜 ' . ($raw['end_date'] ?? ''),
                'start_date' => $raw['start_date'] ?? null,
                'end_date' => $raw['end_date'] ?? null,
                'tyfcb_yen' => $yen,
                'tyfcb_formatted' => $formattedTyfcb,
                'total_referrals' => (int)($raw['total_referrals'] ?? 0),
                'internal_referrals' => (int)($raw['internal_referrals'] ?? 0),
                'external_referrals' => (int)($raw['external_referrals'] ?? 0),
                'external_rate' => (float)($raw['external_rate'] ?? 0.0),
                'visitors' => (int)($raw['visitors'] ?? 0),
                'one_to_ones' => (int)($raw['one_to_ones'] ?? 0),
                'ceu' => (int)($raw['ceu'] ?? 0),
                'member_count' => (int)($raw['member_count'] ?? 0)
            ];
        };

        $periodsSummary = [
            'one_month' => $formatPeriodData($oneMonthRaw, '1ヶ月の成果'),
            'six_months' => $formatPeriodData($sixMonthsRaw, '半年間の成果'),
            'all_time' => $formatPeriodData($allTimeRaw, '全期間の成果')
        ];

        echo json_encode([
            'success' => true,
            'weekly' => $weekly,
            'terms' => $terms,
            'periods_summary' => $periodsSummary
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
        $skipExisting = !empty($input['skipExisting']) || !empty($_GET['skipExisting']);

        $service = new BniConnectService($db);

        if ($weeksCount > 0) {
            $result = $service->syncRecentWeeks($weeksCount, $skipExisting);
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
            // Default to last month (2026-09-01 ~ 2026-09-30) if available, otherwise latest period
            $prefStmt = $pdo->prepare("
                SELECT start_date, end_date 
                FROM palms_reports 
                WHERE start_date = '2026-09-01' AND end_date = '2026-09-30'
                LIMIT 1
            ");
            $prefStmt->execute();
            $latest = $prefStmt->fetch(PDO::FETCH_ASSOC);

            if (!$latest) {
                $latestStmt = $pdo->query("
                    SELECT start_date, end_date 
                    FROM palms_reports 
                    ORDER BY end_date DESC, start_date DESC 
                    LIMIT 1
                ");
                $latest = $latestStmt->fetch(PDO::FETCH_ASSOC);
            }

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
                (SELECT COUNT(DISTINCT v.id) 
                 FROM visitors v 
                 JOIN visitors_status vs ON v.id = vs.visitor_id 
                 WHERE vs.is_joined IN ('入会', '入会済') 
                   AND (
                       TRIM(v.inviter) = TRIM(p.member_name) 
                       OR TRIM(v.inviter) LIKE '%' || TRIM(p.member_name) || '%' 
                       OR TRIM(p.member_name) LIKE '%' || TRIM(v.inviter) || '%'
                   )
                ) as sponsors_count,
                m.category as member_category,
                m.profession as member_profession,
                COALESCE(m.status, '在籍') as member_status
            FROM palms_reports p
            LEFT JOIN members m ON (p.member_name = m.name OR p.member_id = m.id)
            {$whereClause}
            ORDER BY (p.rgi_referrals_given_internal + p.rgo_referrals_given_external) DESC, p.one_to_ones DESC, p.v_visitors DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fallback: If no pre-calculated period record exists in palms_reports,
        // dynamically aggregate weekly records (<= 14 days) within the requested range!
        if (empty($records) && $startDate && $endDate) {
            $aggSql = "
                SELECT 
                    p.member_id,
                    p.member_name,
                    :start_date as start_date,
                    :end_date as end_date,
                    SUM(p.p_present) as p_present,
                    SUM(p.a_absent) as a_absent,
                    SUM(p.l_late) as l_late,
                    SUM(p.m_medical) as m_medical,
                    SUM(p.s_substitute) as s_substitute,
                    SUM(p.rgi_referrals_given_internal) as rgi_referrals_given_internal,
                    SUM(p.rgo_referrals_given_external) as rgo_referrals_given_external,
                    SUM(p.rri_referrals_received_internal) as rri_referrals_received_internal,
                    SUM(p.rro_referrals_received_external) as rro_referrals_received_external,
                    SUM(p.v_visitors) as v_visitors,
                    SUM(p.one_to_ones) as one_to_ones,
                    SUM(p.tyfcb_amount) as tyfcb_amount,
                    SUM(p.ceu) as ceu,
                    SUM(p.testimonials) as testimonials,
                    (SUM(p.rgi_referrals_given_internal) + SUM(p.rgo_referrals_given_external)) as total_referrals_given,
                    (SUM(p.rri_referrals_received_internal) + SUM(p.rro_referrals_received_external)) as total_referrals_received,
                    (SUM(p.tyfcb_amount) * 1000) as tyfcb_yen,
                    (SELECT COUNT(DISTINCT v.id) 
                     FROM visitors v 
                     JOIN visitors_status vs ON v.id = vs.visitor_id 
                     WHERE vs.is_joined IN ('入会', '入会済') 
                       AND (
                           TRIM(v.inviter) = TRIM(p.member_name) 
                           OR TRIM(v.inviter) LIKE '%' || TRIM(p.member_name) || '%' 
                           OR TRIM(p.member_name) LIKE '%' || TRIM(v.inviter) || '%'
                       )
                    ) as sponsors_count,
                    m.category as member_category,
                    m.profession as member_profession,
                    COALESCE(m.status, '在籍') as member_status
                FROM palms_reports p
                LEFT JOIN members m ON (p.member_name = m.name OR p.member_id = m.id)
                WHERE (julianday(p.end_date) - julianday(p.start_date)) <= 14
                  AND p.end_date >= :start_date AND p.start_date <= :end_date
                GROUP BY p.member_id, p.member_name
                ORDER BY (SUM(p.rgi_referrals_given_internal) + SUM(p.rgo_referrals_given_external)) DESC, SUM(p.one_to_ones) DESC, SUM(p.v_visitors) DESC
            ";
            $aggStmt = $pdo->prepare($aggSql);
            $aggStmt->execute([':start_date' => $startDate, ':end_date' => $endDate]);
            $records = $aggStmt->fetchAll(PDO::FETCH_ASSOC);
        }

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
