<?php
/**
 * 2025年1月〜6月（第1期）ビジター申込スプレッドシートインポートスクリプト
 */
require_once __DIR__ . '/../bootstrap.php';

use Api\Core\Database;
use Api\Services\MemberNameResolver;
use Api\Repositories\MemberRepository;

$db = Database::getInstance();
$repo = new MemberRepository();
$members = $repo->getAll();

$spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1Bu9eiJZxxSM4Au6u_KW4KuVC6kKS4zosydupj6cm9i4/export?format=csv&gid=1787825039';

echo "Fetching spreadsheet CSV...\n";
$ch = curl_init($spreadsheetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
$csvContent = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || empty($csvContent)) {
    die("Failed to download CSV from Google Sheets (HTTP {$httpCode})\n");
}

$lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $csvContent));
if (count($lines) < 2) {
    die("CSV content is empty or invalid.\n");
}

$stream = fopen('php://memory', 'r+');
fwrite($stream, $csvContent);
rewind($stream);

$header = fgetcsv($stream);
if (!$header) {
    die("Failed to parse CSV header.\n");
}

// カラムインデックスの特定
$colMap = [];
foreach ($header as $idx => $colName) {
    $colMap[trim($colName)] = $idx;
}

echo "Header columns mapped: " . implode(', ', array_keys($colMap)) . "\n";

// 現在の最大IDを取得
$maxRow = $db->fetchOne("SELECT MAX(CAST(id AS INTEGER)) as max_id FROM visitors WHERE id GLOB '[0-9]*'");
$currentMaxId = (int)($maxRow['max_id'] ?? 0);
echo "Current MAX Visitor ID: {$currentMaxId}\n";

$nextId = $currentMaxId + 1;
$importedCount = 0;
$skippedCount = 0;

$stmtInsertVisitor = $db->getPdo()->prepare("
    INSERT INTO visitors (id, created_at, inviter, event_date, visitor_name, furigana, profession, company, email, attendance_count, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$stmtInsertStatus = $db->getPdo()->prepare("
    INSERT INTO visitors_status (visitor_id, is_attended, is_joined, is_1to1, is_matched, matching_note, updated_at)
    VALUES (?, ?, ?, ?, ?, '', ?)
");

$stmtInsertHearing = $db->getPdo()->prepare("
    INSERT INTO hearing_sheets (visitor_id, orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url, updated_at)
    VALUES (?, ?, '', '', '', '', '', '', '', ?, ?, ?, '', ?)
");

$stmtInsertAction = $db->getPdo()->prepare("
    INSERT INTO action_plans (id, visitor_id, due_date, assignee_name, assignee_id, action_text, is_completed, completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, 1, ?, ?, ?)
");

$db->getPdo()->beginTransaction();

try {
    $rowIdx = 1;
    while (($row = fgetcsv($stream)) !== false) {
        $rowIdx++;
        if (empty($row) || count($row) < 3) continue;

        $name = trim($row[$colMap['氏名'] ?? 3] ?? '');
        if ($name === '' || $name === 'テスト') {
            $skippedCount++;
            continue;
        }

        $timestamp = trim($row[$colMap['タイムスタンプ'] ?? 0] ?? '');
        $email = trim($row[$colMap['メールアドレス'] ?? 1] ?? '');
        $rawInviter = trim($row[$colMap['招待者'] ?? 2] ?? '');
        $furigana = trim($row[$colMap['ふりがな'] ?? 4] ?? '');
        $profession = trim($row[$colMap['お仕事の専門分野'] ?? 5] ?? '');
        $company = trim($row[$colMap['会社名'] ?? 6] ?? '');
        $tel = trim($row[$colMap['連絡先電話番号'] ?? 7] ?? '');
        $zoom = trim($row[$colMap['ZOOM使用経験'] ?? 8] ?? '');
        $booking = trim($row[$colMap['インタビュー予約'] ?? 9] ?? '');
        $rawEventDate = trim($row[$colMap['参加日'] ?? 10] ?? '');
        $memoInfo = trim($row[$colMap['備考情報'] ?? 11] ?? '');
        $interview = trim($row[$colMap['インタビュー内容'] ?? 12] ?? '');
        $nextAction = trim($row[$colMap['次回アクション'] ?? 13] ?? '');
        $result = trim($row[$colMap['結果'] ?? 14] ?? '');

        // 参加日の正規化 (例: 1月9日 -> 2025/01/09)
        $eventDate = '';
        if (preg_match('/(\d+)月(\d+)日/', $rawEventDate, $m)) {
            $month = (int)$m[1];
            $day = (int)$m[2];
            $year = 2025;
            if ($timestamp) {
                $parts = explode(' ', $timestamp);
                $dateParts = explode('/', $parts[0]);
                if (count($dateParts) === 3) {
                    $year = (int)$dateParts[0];
                    if ((int)$dateParts[1] == 12 && $month <= 2) {
                        $year += 1;
                    }
                }
            }
            $eventDate = sprintf('%04d/%02d/%02d', $year, $month, $day);
        }

        // 招待者の名寄せ・正規化
        $inviter = MemberNameResolver::resolve($rawInviter, $members);

        // 備考欄（remarks）に付加情報をまとめる
        $remarksParts = [];
        if ($tel !== '') {
            $remarksParts[] = "TEL: {$tel}";
        }
        if ($zoom !== '') {
            $remarksParts[] = "ZOOM: {$zoom}";
        }
        if ($booking !== '') {
            $remarksParts[] = "予約: {$booking}";
        }
        if ($memoInfo !== '') {
            $remarksParts[] = "備考: {$memoInfo}";
        }
        $remarks = implode(' | ', $remarksParts);

        // 登録日
        $createdAt = $timestamp ?: '2025/01/01 00:00';

        // 1. visitors テーブルに登録
        $vId = (string)$nextId;
        $stmtInsertVisitor->execute([
            $vId,
            $createdAt,
            $inviter,
            $eventDate,
            $name,
            $furigana,
            $profession,
            $company,
            $email,
            '初めて',
            $remarks
        ]);

        // 2. visitors_status テーブル
        // 不参加判定
        $isAttended = '参加';
        if (str_contains($interview, '参加叶わず') || str_contains($memoInfo, '参加は難しい')) {
            $isAttended = '未';
        }

        // 入会判定
        $isJoined = '未';
        if ($result === '入会' || str_contains($nextAction, '入会手続き中')) {
            $isJoined = '入会';
        }

        $stmtInsertStatus->execute([
            $vId,
            $isAttended,
            $isJoined,
            '未',
            '未',
            $createdAt
        ]);

        // 3. hearing_sheets テーブル（インタビューや感触）
        $feelAbc = '';
        if ($result === '入会') {
            $feelAbc = 'A';
        } elseif ($result === '▲') {
            $feelAbc = 'B';
        } elseif ($result === '×') {
            $feelAbc = 'C';
        }

        if ($interview !== '' || $nextAction !== '' || $feelAbc !== '') {
            $stmtInsertHearing->execute([
                $vId,
                $inviter,
                $feelAbc,
                $interview,
                $nextAction,
                $createdAt
            ]);
        }

        // 4. action_plans テーブル（次回アクションがある場合）
        if ($nextAction !== '') {
            $apId = 'ap_' . bin2hex(random_bytes(8));
            $stmtInsertAction->execute([
                $apId,
                $vId,
                $eventDate ?: substr($createdAt, 0, 10),
                $inviter,
                $nextAction,
                $createdAt,
                $createdAt,
                $createdAt
            ]);
        }

        $nextId++;
        $importedCount++;
    }

    $db->getPdo()->commit();
    fclose($stream);

    echo "Successfully imported {$importedCount} visitors (IDs: " . ($currentMaxId + 1) . " to " . ($nextId - 1) . "). Skipped: {$skippedCount}\n";

} catch (\Throwable $e) {
    $db->getPdo()->rollBack();
    fclose($stream);
    die("Error during import: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n");
}
