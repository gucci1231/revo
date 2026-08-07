<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if ($action === 'list') {
    $stmt = $pdo->query("
        SELECT 
            v.id, v.created_at as createdDate, v.inviter, v.event_date as eventDate, 
            v.visitor_name as name, v.furigana, v.profession, v.company, v.email, 
            v.attendance_count as attendanceCount, v.remarks,
            COALESCE(s.is_attended, '未') as isAttended,
            COALESCE(s.is_joined, '未') as isJoined,
            COALESCE(s.is_1to1, '未') as is1to1,
            COALESCE(s.is_matched, '未') as matching,
            CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet,
            COALESCE(h.sheet_url, '') as hearingUrl,
            COALESCE(h.feel_abc, '') as feelAbc,
            COALESCE(h.q7, '') as q7,
            COALESCE(h.orient_user, '') as orientUser,
            COALESCE(h.orient_memo, '') as orientMemo
        FROM visitors v
        LEFT JOIN visitors_status s ON v.id = s.visitor_id
        LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
        ORDER BY v.event_date DESC
    ");
    $list = $stmt->fetchAll();
    sendJsonResponse(['success' => true, 'list' => $list]);
}

if ($action === 'detail') {
    $id = $_GET['id'] ?? $input['id'] ?? '';
    if (!$id) sendJsonResponse(['success' => false, 'message' => 'ID is required']);

    $stmtV = $pdo->prepare("SELECT * FROM visitors WHERE id = ?");
    $stmtV->execute([$id]);
    $visitor = $stmtV->fetch();

    if (!$visitor) sendJsonResponse(['success' => false, 'message' => 'Visitor not found']);

    $stmtS = $pdo->prepare("SELECT * FROM visitors_status WHERE visitor_id = ?");
    $stmtS->execute([$id]);
    $status = $stmtS->fetch() ?: ['is_attended' => '未', 'is_joined' => '未', 'is_1to1' => '未', 'is_matched' => '未'];

    $stmtH = $pdo->prepare("SELECT * FROM hearing_sheets WHERE visitor_id = ?");
    $stmtH->execute([$id]);
    $hearing = $stmtH->fetch() ?: null;

    sendJsonResponse([
        'success' => true,
        'visitor' => [
            'id' => $visitor['id'],
            'createdAt' => $visitor['created_at'],
            'inviter' => $visitor['inviter'],
            'eventDate' => $visitor['event_date'],
            'name' => $visitor['visitor_name'],
            'furigana' => $visitor['furigana'],
            'profession' => $visitor['profession'],
            'company' => $visitor['company'],
            'email' => $visitor['email'],
            'attendanceCount' => $visitor['attendance_count'],
            'remarks' => $visitor['remarks']
        ],
        'status' => [
            'isAttended' => $status['is_attended'] ?? '未',
            'isJoined' => $status['is_joined'] ?? '未',
            'is1to1' => $status['is_1to1'] ?? '未',
            'matching' => $status['is_matched'] ?? '未'
        ],
        'hearing' => $hearing ? [
            'orientUser' => $hearing['orient_user'],
            'q1' => $hearing['q1'], 'q2' => $hearing['q2'], 'q3' => $hearing['q3'],
            'q4' => $hearing['q4'], 'q5' => $hearing['q5'], 'q6' => $hearing['q6'], 'q7' => $hearing['q7'],
            'feelAbc' => $hearing['feel_abc'],
            'orientMemo' => $hearing['orient_memo'],
            'followMemo' => $hearing['follow_memo'],
            'sheetUrl' => $hearing['sheet_url'],
            'updatedAt' => $hearing['updated_at']
        ] : null,
        'mailLogs' => []
    ]);
}

if ($action === 'add') {
    $maxId = $pdo->query("SELECT MAX(CAST(id AS INTEGER)) FROM visitors")->fetchColumn() ?: 0;
    $newId = (string)($maxId + 1);
    $now = date('Y/m/d H:i');

    $stmt = $pdo->prepare("
        INSERT INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $newId, $now, $input['inviter'] ?? '', $input['eventDate'] ?? '',
        $input['name'] ?? '', $input['furigana'] ?? '', $input['profession'] ?? '',
        $input['company'] ?? '', $input['email'] ?? '', $input['attendanceCount'] ?? '初めて',
        $input['remarks'] ?? ''
    ]);

    $stmtS = $pdo->prepare("INSERT INTO visitors_status (visitor_id, updated_at) VALUES (?, ?)");
    $stmtS->execute([$newId, $now]);

    sendJsonResponse(['success' => true, 'visitorId' => $newId]);
}

if ($action === 'update_status') {
    $vId = $input['visitorId'] ?? '';
    $field = $input['field'] ?? '';
    $val = $input['value'] ?? '';

    $colMap = [
        'isAttended' => 'is_attended',
        'isJoined' => 'is_joined',
        'is1to1' => 'is_1to1',
        'matching' => 'is_matched'
    ];

    if (!isset($colMap[$field])) sendJsonResponse(['success' => false, 'message' => 'Invalid field']);

    $col = $colMap[$field];
    $now = date('Y/m/d H:i');

    $stmt = $pdo->prepare("
        INSERT INTO visitors_status (visitor_id, $col, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(visitor_id) DO UPDATE SET $col = excluded.$col, updated_at = excluded.updated_at
    ");
    $stmt->execute([$vId, $val, $now]);

    sendJsonResponse(['success' => true, 'visitorId' => $vId]);
}

if ($action === 'save_memo') {
    $vId = $input['visitorId'] ?? '';
    $memo = $input['memo'] ?? '';

    $stmt = $pdo->prepare("UPDATE visitors SET remarks = ? WHERE id = ?");
    $stmt->execute([$memo, $vId]);

    sendJsonResponse(['success' => true, 'visitorId' => $vId, 'memo' => $memo]);
}

sendJsonResponse(['success' => false, 'message' => 'Invalid action']);
