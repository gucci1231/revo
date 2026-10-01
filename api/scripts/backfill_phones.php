<?php
/**
 * スプレッドシート（Totalシート・Listシート）および備考欄からビジターの電話番号を一括抽出し、
 * visitors.phone にバックフィルするスクリプト
 */
require_once __DIR__ . '/../bootstrap.php';

use Api\Core\Database;

echo "=== ビジター電話番号 一括バックフィル 開始 ===\n";

$db = Database::getInstance();
$pdo = $db->getPdo();

// 1. カラム存在確認・追加
try {
    $pdo->exec("ALTER TABLE visitors ADD COLUMN phone TEXT DEFAULT ''");
    echo "Added 'phone' column to visitors table.\n";
} catch (\PDOException $e) {}

// 2. Google Sheets から Total と List の CSV を取得
$spreadsheetId = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';

function fetchCsv(string $url): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');
    $content = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || empty($content)) {
        return [];
    }

    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $content);
    rewind($stream);

    $header = null;
    $rows = [];
    while (($row = fgetcsv($stream)) !== false) {
        if (empty($row)) continue;
        if (!$header) {
            $header = array_map(function($h) {
                return preg_replace('/\x{EF}\x{BB}\x{BF}/', '', trim((string)$h));
            }, $row);
        } else {
            $rowData = [];
            foreach ($header as $idx => $hName) {
                if ($hName !== '') {
                    $rowData[$hName] = isset($row[$idx]) ? trim((string)$row[$idx]) : '';
                }
            }
            $rows[] = $rowData;
        }
    }
    fclose($stream);
    return $rows;
}

function cleanPhone(string $p): string {
    $p = trim($p);
    if ($p === '') return '';
    $p = preg_replace('/[（\(][^）\)]*[）\)]/u', '', $p);
    $clean = preg_replace('/[^0-9\-+]/', '', $p);
    return trim($clean, '-');
}

function normName(string $s): string {
    return preg_replace('/[\s　]+/u', '', trim($s));
}

function normEmail(string $s): string {
    return strtolower(trim(str_replace('＠', '@', $s)));
}

echo "Google Sheets から CSV 取得中...\n";
$totalUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode('Total');
$listUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode('List');

$totalRows = fetchCsv($totalUrl);
$listRows = fetchCsv($listUrl);

echo "Total 行数: " . count($totalRows) . ", List 行数: " . count($listRows) . "\n";

$phoneMap = [];

foreach ($totalRows as $tr) {
    $p = cleanPhone($tr['連絡先'] ?? '');
    if ($p === '') continue;
    $e = normEmail($tr['email'] ?? '');
    $n = normName($tr['氏名'] ?? '');
    if ($e) $phoneMap['email:' . $e] = $p;
    if ($n) $phoneMap['name:' . $n] = $p;
}

foreach ($listRows as $lr) {
    $p = cleanPhone($lr['連絡先電話番号'] ?? $lr['電話番号'] ?? $lr['連絡先'] ?? '');
    if ($p === '') continue;
    $e = normEmail($lr['メールアドレス'] ?? '');
    $n = normName($lr['氏名'] ?? $lr['お名前'] ?? '');
    if ($e) $phoneMap['email:' . $e] = $p;
    if ($n) $phoneMap['name:' . $n] = $p;
}

echo "電話番号マップ構築完了: " . count($phoneMap) . " キー\n";

// 3. SQLite visitors テーブルを更新
$visitors = $pdo->query("SELECT id, visitor_name, email, remarks, phone FROM visitors")->fetchAll(PDO::FETCH_ASSOC);

$updateStmt = $pdo->prepare("UPDATE visitors SET phone = :phone WHERE id = :id");
$updatedCount = 0;

$pdo->beginTransaction();

foreach ($visitors as $v) {
    $existingPhone = trim((string)($v['phone'] ?? ''));
    if ($existingPhone !== '') continue;

    $n = normName($v['visitor_name'] ?? '');
    $e = normEmail($v['email'] ?? '');

    $p = $phoneMap['email:' . $e] ?? $phoneMap['name:' . $n] ?? '';

    if ($p === '' && !empty($v['remarks']) && str_contains($v['remarks'], 'TEL:')) {
        if (preg_match('/TEL:\s*([0-9\-]+)/', $v['remarks'], $pm)) {
            $p = cleanPhone($pm[1]);
        }
    }

    if ($p !== '') {
        $updateStmt->execute([':phone' => $p, ':id' => $v['id']]);
        $updatedCount++;
    }
}

$pdo->commit();

echo "✅ バックフィル完了: {$updatedCount} 件のビジターに電話番号を登録しました。\n";
