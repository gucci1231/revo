<?php
require_once __DIR__ . '/db.php';

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input && !empty($_POST['payload'])) {
    $input = json_decode($_POST['payload'], true);
}
if (!$input) {
    $input = $_POST;
}

$addedCount = 0;
$json = null;

// 1. Primary: Direct POST body payload (Webhook / PUSH sync from Google Sheets / Form)
if (!empty($input['visitors']) || !empty($input['hearings']) || !empty($input['members'])) {
    $json = $input;
} else {
    // 2. Fallback PULL: Try GAS Export URL
    $gasUrl = "https://script.google.com/macros/s/AKfycbydC-gIMjpdAoeQpsgIwq-RQcBzWHZ17yijcMxc_zm2BNZfWxbij9DO2XutZxs1jO11/exec?api=export";
    try {
        $ch = curl_init($gasUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        curl_close($ch);
        if ($response) {
            $decoded = json_decode($response, true);
            if (is_array($decoded) && (!empty($decoded['visitors']) || !empty($decoded['hearings']) || !empty($decoded['members']))) {
                $json = $decoded;
            }
        }
    } catch (Exception $e) {}

    // 3. Direct Google Sheets CSV Export Fallback (100% reliable public fetch)
    if (!$json) {
        $spreadsheetId = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';
        $json = fetchFromGoogleSheetsCsv($spreadsheetId);
    }
}

function fetchSheetCsv($spreadsheetId, $sheetName) {
    $url = "https://docs.google.com/spreadsheets/d/" . urlencode($spreadsheetId) . "/gviz/tq?tqx=out:csv&sheet=" . urlencode($sheetName);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    $csvData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$csvData) {
        return [];
    }

    $lines = explode("\n", str_replace("\r\n", "\n", $csvData));
    $header = null;
    $rows = [];
    foreach ($lines as $line) {
        if (trim($line) === '') continue;
        $row = str_getcsv($line);
        if (!$header) {
            $header = array_map('trim', $row);
        } else {
            if (count($row) === count($header)) {
                $rows[] = array_combine($header, $row);
            }
        }
    }
    return $rows;
}

function fetchFromGoogleSheetsCsv($spreadsheetId) {
    $visitorsRaw = fetchSheetCsv($spreadsheetId, 'visitors');
    $statusRaw = fetchSheetCsv($spreadsheetId, 'visitors_status');
    $hearingsRaw = fetchSheetCsv($spreadsheetId, 'hearing_sheets');
    $membersRaw = fetchSheetCsv($spreadsheetId, 'members');

    $statusMap = [];
    foreach ($statusRaw as $st) {
        $vId = (string)($st['visitor_id'] ?? '');
        if ($vId !== '') {
            $statusMap[$vId] = $st;
        }
    }

    $visitors = [];
    foreach ($visitorsRaw as $v) {
        $vId = (string)($v['id'] ?? '');
        if ($vId === '') continue;

        $st = $statusMap[$vId] ?? [];
        $visitors[] = [
            'id' => $vId,
            'created_at' => $v['created_at'] ?? '',
            'inviter' => $v['inviter'] ?? '',
            'event_date' => $v['event_date'] ?? '',
            'visitor_name' => $v['visitor_name'] ?? '',
            'furigana' => $v['furigana'] ?? '',
            'profession' => $v['profession'] ?? '',
            'company' => $v['company'] ?? '',
            'email' => $v['email'] ?? '',
            'attendance_count' => $v['attendance_count'] ?? '初めて',
            'remarks' => $v['remarks'] ?? '',
            'is_attended' => $st['is_attended'] ?? '未',
            'is_joined' => $st['is_joined'] ?? '未',
            'is_1to1' => $st['is_1to1'] ?? '未',
            'is_matched' => $st['is_matched'] ?? '未',
            'matching_note' => $st['matching_note'] ?? ''
        ];
    }

    $hearings = [];
    foreach ($hearingsRaw as $h) {
        $vId = (string)($h['visitor_id'] ?? '');
        if ($vId === '') continue;
        $hearings[] = [
            'visitor_id' => $vId,
            'orient_user' => $h['orient_user'] ?? '',
            'q1' => $h['q1'] ?? '', 'q2' => $h['q2'] ?? '', 'q3' => $h['q3'] ?? '',
            'q4' => $h['q4'] ?? '', 'q5' => $h['q5'] ?? '', 'q6' => $h['q6'] ?? '', 'q7' => $h['q7'] ?? '',
            'feel_abc' => $h['feel_abc'] ?? '',
            'orient_memo' => $h['orient_memo'] ?? '',
            'follow_memo' => $h['follow_memo'] ?? '',
            'sheet_url' => $h['sheet_url'] ?? '',
            'updated_at' => $h['updated_at'] ?? ''
        ];
    }

    $members = [];
    foreach ($membersRaw as $m) {
        $mId = (string)($m['id'] ?? '');
        if ($mId === '') continue;
        $members[] = [
            'id' => $mId,
            'category' => $m['category'] ?? 'その他',
            'name' => $m['name'] ?? '',
            'profession' => $m['profession'] ?? ''
        ];
    }

    return [
        'visitors' => $visitors,
        'hearings' => $hearings,
        'members' => $members
    ];
}

if ($json) {
    try {
        if (!empty($json['visitors'])) {
            $stmtV = $pdo->prepare("
                INSERT OR REPLACE INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmtS = $pdo->prepare("
                INSERT OR REPLACE INTO visitors_status (visitor_id, is_attended, is_joined, is_1to1, is_matched, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            $now = date('Y/m/d H:i');

            foreach ($json['visitors'] as $v) {
                $vId = (string)($v['id'] ?? $v['no'] ?? '');
                if (!$vId) continue;

                $stmtV->execute([
                    $vId,
                    $v['createdDate'] ?? $v['created_at'] ?? $now,
                    $v['inviter'] ?? '',
                    $v['eventDate'] ?? $v['event_date'] ?? '',
                    $v['name'] ?? $v['visitor_name'] ?? '',
                    $v['furigana'] ?? '',
                    $v['profession'] ?? '',
                    $v['company'] ?? '',
                    $v['email'] ?? '',
                    $v['attendanceCount'] ?? $v['attendance_count'] ?? '初めて',
                    $v['remarks'] ?? ''
                ]);

                $stmtS->execute([
                    $vId,
                    $v['isAttended'] ?? $v['is_attended'] ?? '未',
                    $v['isJoined'] ?? $v['is_joined'] ?? '未',
                    $v['is1to1'] ?? $v['is_1to1'] ?? '未',
                    $v['matching'] ?? $v['is_matched'] ?? '未',
                    $now
                ]);

                $addedCount++;
            }
        }

        if (!empty($json['hearings'])) {
            $stmtH = $pdo->prepare("
                INSERT OR REPLACE INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $now = date('Y/m/d H:i');

            foreach ($json['hearings'] as $h) {
                $vId = (string)($h['visitorId'] ?? $h['visitor_id'] ?? '');
                if (!$vId) continue;

                $stmtH->execute([
                    $vId,
                    $h['orientUser'] ?? $h['orient_user'] ?? '',
                    $h['q1'] ?? '', $h['q2'] ?? '', $h['q3'] ?? '',
                    $h['q4'] ?? '', $h['q5'] ?? '', $h['q6'] ?? '', $h['q7'] ?? '',
                    $h['feelAbc'] ?? $h['feel_abc'] ?? '',
                    $h['orientMemo'] ?? $h['orient_memo'] ?? '',
                    $h['followMemo'] ?? $h['follow_memo'] ?? '',
                    $h['sheetUrl'] ?? $h['sheet_url'] ?? '',
                    $h['updatedAt'] ?? $h['updated_at'] ?? $now
                ]);
            }
        }

        if (!empty($json['members'])) {
            $stmtM = $pdo->prepare("
                INSERT OR REPLACE INTO members (id, category, name, profession, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ");

            $now = date('Y/m/d H:i');

            foreach ($json['members'] as $m) {
                $mId = (string)($m['id'] ?? '');
                if (!$mId) continue;

                $stmtM->execute([
                    $mId, $m['category'] ?? 'その他', $m['name'] ?? '', $m['profession'] ?? '', $now
                ]);
            }
        }
    } catch (Exception $e) {
        sendJsonResponse(['success' => false, 'message' => 'Sync failed: ' . $e->getMessage()]);
    }
}

sendJsonResponse([
    'success' => true,
    'addedCount' => $addedCount,
    'message' => "同期完了: {$addedCount} 件のデータをSQLiteデータベースへ同期しました。"
]);


