<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if ($action === 'list') {
    $stmt = $pdo->query("
        SELECT 
            h.visitor_id as visitorId, 
            COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || h.visitor_id) as name, 
            COALESCE(v.company, '') as company, 
            COALESCE(v.profession, '') as profession, 
            COALESCE(v.inviter, '') as inviter, 
            COALESCE(NULLIF(v.event_date, ''), h.updated_at) as eventDate,
            h.orient_user as orientUser, h.q1, h.q2, h.q3, h.q4, h.q5, h.q6, h.q7, h.feel_abc as feelAbc,
            h.orient_memo as orientMemo, h.follow_memo as followMemo, h.sheet_url as sheetUrl, h.updated_at as updatedAt,
            COALESCE(s.is_attended, '未') as isAttended, COALESCE(s.is_joined, '未') as isJoined, COALESCE(s.is_1to1, '未') as is1to1
        FROM hearing_sheets h
        LEFT JOIN visitors v ON h.visitor_id = v.id
        LEFT JOIN visitors_status s ON h.visitor_id = s.visitor_id
        ORDER BY h.updated_at DESC
    ");
    $list = $stmt->fetchAll();
    sendJsonResponse(['success' => true, 'list' => $list]);
}

if ($action === 'get') {
    $vId = $_GET['visitorId'] ?? $input['visitorId'] ?? '';
    if (!$vId) sendJsonResponse(['success' => false, 'message' => 'visitorId is required']);

    $stmtV = $pdo->prepare("SELECT visitor_name as visitor_name, inviter, company, profession, event_date as event_date FROM visitors WHERE id = ?");
    $stmtV->execute([$vId]);
    $vInfo = $stmtV->fetch() ?: ['visitor_name' => '', 'inviter' => '', 'company' => '', 'profession' => '', 'event_date' => ''];

    $stmtH = $pdo->prepare("SELECT * FROM hearing_sheets WHERE visitor_id = ?");
    $stmtH->execute([$vId]);
    $h = $stmtH->fetch();

    $formData = [
        'visitorId' => $vId,
        'orientUser' => $h['orient_user'] ?? '',
        'q1' => $h['q1'] ?? '', 'q2' => $h['q2'] ?? '', 'q3' => $h['q3'] ?? '',
        'q4' => $h['q4'] ?? '', 'q5' => $h['q5'] ?? '', 'q6' => $h['q6'] ?? '', 'q7' => $h['q7'] ?? '',
        'feelAbc' => $h['feel_abc'] ?? '',
        'orientMemo' => $h['orient_memo'] ?? '',
        'followMemo' => $h['follow_memo'] ?? '',
        'sheetUrl' => $h['sheet_url'] ?? ''
    ];

    sendJsonResponse(['success' => true, 'visitorInfo' => $vInfo, 'formData' => $formData, 'memberCategories' => []]);
}

if ($action === 'save') {
    $vId = $input['visitorId'] ?? '';
    if (!$vId) sendJsonResponse(['success' => false, 'message' => 'visitorId is required']);

    $now = date('Y/m/d H:i');

    $stmt = $pdo->prepare("
        INSERT INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(visitor_id) DO UPDATE SET
            orient_user = excluded.orient_user, q1 = excluded.q1, q2 = excluded.q2, q3 = excluded.q3,
            q4 = excluded.q4, q5 = excluded.q5, q6 = excluded.q6, q7 = excluded.q7,
            feel_abc = excluded.feel_abc, orient_memo = excluded.orient_memo, follow_memo = excluded.follow_memo,
            sheet_url = excluded.sheet_url, updated_at = excluded.updated_at
    ");
    $stmt->execute([
        $vId, $input['orientUser'] ?? '', $input['q1'] ?? '', $input['q2'] ?? '', $input['q3'] ?? '',
        $input['q4'] ?? '', $input['q5'] ?? '', $input['q6'] ?? '', $input['q7'] ?? '', $input['feelAbc'] ?? '',
        $input['orientMemo'] ?? '', $input['followMemo'] ?? '', $input['sheetUrl'] ?? '', $now
    ]);

    sendJsonResponse(['success' => true, 'visitorId' => $vId]);
}

sendJsonResponse(['success' => false, 'message' => 'Invalid action']);
