<?php
require_once __DIR__ . '/db.php';

$gasUrl = "https://script.google.com/macros/s/AKfycbydC-gIMjpdAoeQpsgIwq-RQcBzWHZ17yijcMxc_zm2BNZfWxbij9DO2XutZxs1jO11/exec?api=export";

$addedCount = 0;

try {
    $ch = curl_init($gasUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);

    if ($response) {
        $json = json_decode($response, true);

        if ($json && !empty($json['visitors'])) {
            $stmtV = $pdo->prepare("
                INSERT INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    inviter = excluded.inviter, event_date = excluded.event_date, visitor_name = excluded.visitor_name,
                    furigana = excluded.furigana, profession = excluded.profession, company = excluded.company,
                    email = excluded.email, attendance_count = excluded.attendance_count, remarks = excluded.remarks
            ");

            $stmtS = $pdo->prepare("
                INSERT INTO visitors_status (visitor_id, is_attended, is_joined, is_1to1, is_matched, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(visitor_id) DO UPDATE SET
                    is_attended = excluded.is_attended, is_joined = excluded.is_joined,
                    is_1to1 = excluded.is_1to1, is_matched = excluded.is_matched, updated_at = excluded.updated_at
            ");

            $now = date('Y/m/d H:i');

            foreach ($json['visitors'] as $v) {
                $vId = (string)($v['id'] ?? $v['no'] ?? '');
                if (!$vId) continue;

                $stmtV->execute([
                    $vId,
                    $v['createdDate'] ?? $now,
                    $v['inviter'] ?? '',
                    $v['eventDate'] ?? '',
                    $v['name'] ?? '',
                    $v['furigana'] ?? '',
                    $v['profession'] ?? '',
                    $v['company'] ?? '',
                    $v['email'] ?? '',
                    $v['attendanceCount'] ?? '初めて',
                    $v['remarks'] ?? ''
                ]);

                $stmtS->execute([
                    $vId,
                    $v['isAttended'] ?? '未',
                    $v['isJoined'] ?? '未',
                    $v['is1to1'] ?? '未',
                    $v['matching'] ?? '未',
                    $now
                ]);

                $addedCount++;
            }
        }

        if ($json && !empty($json['hearings'])) {
            $stmtH = $pdo->prepare("
                INSERT INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(visitor_id) DO UPDATE SET
                    orient_user = excluded.orient_user, feel_abc = excluded.feel_abc, q7 = excluded.q7,
                    orient_memo = excluded.orient_memo, follow_memo = excluded.follow_memo, sheet_url = excluded.sheet_url, updated_at = excluded.updated_at
            ");

            $now = date('Y/m/d H:i');

            foreach ($json['hearings'] as $h) {
                $vId = (string)($h['visitorId'] ?? '');
                if (!$vId) continue;

                $stmtH->execute([
                    $vId, $h['orientUser'] ?? '', $h['q1'] ?? '', $h['q2'] ?? '', $h['q3'] ?? '',
                    $h['q4'] ?? '', $h['q5'] ?? '', $h['q6'] ?? '', $h['q7'] ?? '', $h['feelAbc'] ?? '',
                    $h['orientMemo'] ?? '', $h['followMemo'] ?? '', $h['sheetUrl'] ?? '', $h['updatedAt'] ?? $now
                ]);
            }
        }

        if ($json && !empty($json['members'])) {
            $stmtM = $pdo->prepare("
                INSERT INTO members (id, category, name, profession, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    category = excluded.category, name = excluded.name, profession = excluded.profession, updated_at = excluded.updated_at
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
    }
} catch (Exception $e) {
    sendJsonResponse(['success' => false, 'message' => 'Sync failed: ' . $e->getMessage()]);
}

sendJsonResponse([
    'success' => true,
    'addedCount' => $addedCount,
    'message' => "同期完了: スプレッドシートから {$addedCount} 件のデータをSQLiteデータベースへ初回同期・取り込みました。"
]);
