<?php
/**
 * Backfill & Reclassify Visitor vs Guest Categories
 * スプレッドシートの種別・チャプターフラグに基づき、visitorsテーブルのcategoryを一括再分類
 */

require_once __DIR__ . '/../Core/Database.php';

use App\Core\Database;

$db = Database::getInstance();

$spreadsheetId = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';

function fetchCsv(string $url): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$data) {
        return [];
    }

    $lines = explode("\n", $data);
    if (empty($lines)) return [];

    $rows = [];
    $header = null;
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $cols = str_getcsv($line);
        if ($header === null) {
            $header = $cols;
        } else {
            $row = [];
            foreach ($header as $i => $h) {
                $row[$h] = $cols[$i] ?? '';
            }
            $rows[] = $row;
        }
    }
    return $rows;
}

function cleanName(string $name): string {
    return trim(preg_replace('/[\s　]+/u', '', $name));
}

function normalizeDate(string $d): string {
    if (!$d) return '';
    if (preg_match('/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/', $d, $m)) {
        return sprintf('%04d/%02d/%02d', (int)$m[1], (int)$m[2], (int)$m[3]);
    }
    if (preg_match('/(\d{1,2})[\/\-](\d{1,2})/', $d, $m)) {
        return sprintf('2025/%02d/%02d', (int)$m[1], (int)$m[2]);
    }
    return trim($d);
}

function normalizeEmail(string $e): string {
    return strtolower(trim(str_replace('＠', '@', $e)));
}

function isGuestRecord(string $type, string $chapter, string $attendance, string $prof, string $comp, string $rem, string $name = ''): bool {
    if (str_contains($type, 'ゲスト') || str_contains($type, '他チャプター')) return true;
    if (str_contains($type, '代理人')) return true;
    $trimChap = trim($chapter);
    if ($trimChap !== '' && $trimChap !== '-' && !str_contains($trimChap, 'なし') && !str_contains($trimChap, 'REvo') && !str_contains($trimChap, 'レボ') && !str_contains($trimChap, '未定')) {
        return true;
    }
    if (str_contains($attendance, 'ゲスト') || str_contains($attendance, '他チャプター')) return true;
    if (str_contains($prof, 'ゲスト') || str_contains($comp, 'ゲスト') || str_contains($rem, 'ゲスト') || str_contains($rem, '予約: ゲスト')) return true;
    if (str_contains($rem, 'ユニコーン') || str_contains($rem, 'チャプター') || str_contains($prof, 'ユニコーン') || str_starts_with($name, 'メンバー')) return true;
    return false;
}

echo "=== Fetching Google Sheets CSV ===\n";
$totalUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode('Total');
$listUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode('List');

$totalRows = fetchCsv($totalUrl);
$listRows = fetchCsv($listUrl);

echo "Total sheet rows: " . count($totalRows) . "\n";
echo "List sheet rows: " . count($listRows) . "\n";

$categoryMap = [];

foreach ($totalRows as $tr) {
    $n = cleanName($tr['氏名'] ?? '');
    $d = normalizeDate($tr['参加日 ▼'] ?? $tr['参加日'] ?? '');
    $e = normalizeEmail($tr['email'] ?? '');
    $isG = isGuestRecord(
        (string)($tr['種別'] ?? ''),
        (string)($tr['チャプター名'] ?? ''),
        (string)($tr['参加回数'] ?? ''),
        (string)($tr['お仕事の専門分野'] ?? ''),
        (string)($tr['会社名'] ?? ''),
        '',
        $n
    );
    $cat = $isG ? 'ゲスト' : 'ビジター';
    if ($n && $d) $categoryMap["nd:{$n}_{$d}"] = $cat;
    if ($e && $d) $categoryMap["ed:{$e}_{$d}"] = $cat;
    if ($n && (!isset($categoryMap["n:{$n}"]) || $isG)) $categoryMap["n:{$n}"] = $cat;
    if ($e && (!isset($categoryMap["e:{$e}"]) || $isG)) $categoryMap["e:{$e}"] = $cat;
}

foreach ($listRows as $lr) {
    $n = cleanName($lr['氏名'] ?? $lr['お名前'] ?? '');
    $d = normalizeDate($lr['参加日'] ?? $lr['参加予定日'] ?? $lr['日程'] ?? '');
    $e = normalizeEmail($lr['メールアドレス'] ?? '');
    $isG = isGuestRecord(
        (string)($lr['種別'] ?? ''),
        (string)($lr['ゲスト（他チャプター等の方、所属チャプター名をご記名ください）'] ?? $lr['チャプター名'] ?? ''),
        (string)($lr['定例会へのビジター参加回数'] ?? $lr['参加回数'] ?? ''),
        (string)($lr['お仕事の専門分野'] ?? $lr['専門分野'] ?? $lr['業種'] ?? ''),
        (string)($lr['会社名'] ?? $lr['屋号'] ?? ''),
        '',
        $n
    );
    $cat = $isG ? 'ゲスト' : 'ビジター';
    if ($n && $d) $categoryMap["nd:{$n}_{$d}"] = $cat;
    if ($e && $d) $categoryMap["ed:{$e}_{$d}"] = $cat;
    if ($n && (!isset($categoryMap["n:{$n}"]) || $isG)) $categoryMap["n:{$n}"] = $cat;
    if ($e && (!isset($categoryMap["e:{$e}"]) || $isG)) $categoryMap["e:{$e}"] = $cat;
}

$visitors = $db->fetchAll("SELECT id, visitor_name, email, event_date, category, remarks, attendance_count, company, profession FROM visitors ORDER BY CAST(id AS INTEGER) ASC");

$updatedCount = 0;
$guestCount = 0;
$visitorCount = 0;

foreach ($visitors as $v) {
    $vId = $v['id'];
    $n = cleanName($v['visitor_name']);
    $d = normalizeDate($v['event_date']);
    $e = normalizeEmail($v['email']);

    $cat = '';
    if ($n && $d && isset($categoryMap["nd:{$n}_{$d}"])) {
        $cat = $categoryMap["nd:{$n}_{$d}"];
    } elseif ($e && $d && isset($categoryMap["ed:{$e}_{$d}"])) {
        $cat = $categoryMap["ed:{$e}_{$d}"];
    } elseif ($n && isset($categoryMap["n:{$n}"])) {
        $cat = $categoryMap["n:{$n}"];
    } elseif ($e && isset($categoryMap["e:{$e}"])) {
        $cat = $categoryMap["e:{$e}"];
    }

    if (!$cat) {
        if (($v['category'] ?? '') === 'ゲスト') {
            $cat = 'ゲスト';
        } else {
            $isG = isGuestRecord('', '', (string)($v['attendance_count'] ?? ''), (string)($v['profession'] ?? ''), (string)($v['company'] ?? ''), (string)($v['remarks'] ?? ''), $v['visitor_name']);
            $cat = $isG ? 'ゲスト' : 'ビジター';
        }
    }

    if ($cat === 'ゲスト') {
        $guestCount++;
    } else {
        $visitorCount++;
    }

    if ($cat !== ($v['category'] ?? '')) {
        $db->update('visitors', ['category' => $cat], 'id = ?', [$vId]);
        echo "Updated [ID {$vId}] {$v['visitor_name']} ({$v['event_date']}): {$v['category']} -> {$cat}\n";
        $updatedCount++;
    }
}

echo "=== Complete ===\n";
echo "Total processed: " . count($visitors) . "\n";
echo "Updated: {$updatedCount}\n";
echo "Guests: {$guestCount}, Visitors: {$visitorCount}\n";
