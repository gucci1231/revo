<?php
require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$addedCount = 0;

$json = null;

// 1. Primary: Direct POST body payload (Webhook / PUSH sync from Google Sheets / Form)
if (!empty($input['visitors']) || !empty($input['hearings']) || !empty($input['members'])) {
    $json = $input;
} else {
    // 2. Fallback: PULL from GAS Export URL if configured
    $gasUrl = "https://script.google.com/macros/s/AKfycbydC-gIMjpdAoeQpsgIwq-RQcBzWHZ17yijcMxc_zm2BNZfWxbij9DO2XutZxs1jO11/exec?api=export";
    try {
        $ch = curl_init($gasUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $response = curl_exec($ch);
        curl_close($ch);
        if ($response) {
            $json = json_decode($response, true);
        }
    } catch (Exception $e) {}
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

