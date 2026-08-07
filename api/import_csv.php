<?php
require_once __DIR__ . '/db.php';

$csvFile = __DIR__ . '/../visitor_orientation_sheets-v3.csv';

if (!file_exists($csvFile)) {
    sendJsonResponse(['success' => false, 'message' => 'CSV file not found: ' . $csvFile]);
}

$handle = fopen($csvFile, 'r');
if (!$handle) {
    sendJsonResponse(['success' => false, 'message' => 'Failed to open CSV file']);
}

// Header
$header = fgetcsv($handle);

$stmtH = $pdo->prepare("
    INSERT OR REPLACE INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$stmtV = $pdo->prepare("
    INSERT OR IGNORE INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$stmtS = $pdo->prepare("
    INSERT OR IGNORE INTO visitors_status (visitor_id, is_attended, is_joined, is_1to1, is_matched, updated_at)
    VALUES (?, '未', '未', '未', '未', ?)
");

$count = 0;
$now = date('Y/m/d H:i');

while (($data = fgetcsv($handle)) !== false) {
    if (empty($data[0])) continue;
    $vId = trim($data[0]);

    $orientUser = $data[1] ?? '';
    $q1 = $data[2] ?? '';
    $q2 = $data[3] ?? '';
    $q3 = $data[4] ?? '';
    $q4 = $data[5] ?? '';
    $q5 = $data[6] ?? '';
    $q6 = $data[7] ?? '';
    $q7 = $data[8] ?? '';
    $feelAbc = $data[9] ?? '';
    $orientMemo = $data[10] ?? '';
    $followMemo = $data[11] ?? '';
    $sheetUrl = $data[12] ?? '';
    $updatedAt = !empty($data[13]) ? trim($data[13]) : $now;

    // Save to hearing_sheets
    $stmtH->execute([
        $vId, $orientUser, $q1, $q2, $q3, $q4, $q5, $q6, $q7, $feelAbc, $orientMemo, $followMemo, $sheetUrl, $updatedAt
    ]);

    // Ensure visitor record exists
    $stmtV->execute([
        $vId, $updatedAt, '', $updatedAt, "ビジター No." . $vId, '', '', '', '', '初めて', ''
    ]);

    // Ensure status record exists
    $stmtS->execute([
        $vId, $updatedAt
    ]);

    $count++;
}

fclose($handle);

sendJsonResponse([
    'success' => true,
    'importedCount' => $count,
    'message' => "CSVから {$count} 件のデータをSQLiteへインポートしました。"
]);
