<?php
namespace Api\Services;

use Api\Core\Database;
use Exception;

class SyncService {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function processSync(?array $input): array {
        $addedCount = 0;
        $json = null;

        if (!empty($input['visitors']) || !empty($input['hearings']) || !empty($input['members'])) {
            $json = $input;
        } else {
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

            if (!$json) {
                $spreadsheetId = '1wMXXurT9uWpythSDKSggjJESldIrqc0_5PL22LXDSGQ';
                $json = $this->fetchFromGoogleSheetsCsv($spreadsheetId);
            }
        }

        if ($json) {
            $now = date('Y/m/d H:i');

            if (!empty($json['visitors'])) {
                foreach ($json['visitors'] as $v) {
                    $vId = (string)($v['id'] ?? $v['no'] ?? '');
                    if (!$vId) continue;

                    $this->db->upsert('visitors', [
                        'id' => $vId,
                        'created_at' => $v['createdDate'] ?? $v['created_at'] ?? $now,
                        'inviter' => $v['inviter'] ?? '',
                        'event_date' => $v['eventDate'] ?? $v['event_date'] ?? '',
                        'visitor_name' => $v['name'] ?? $v['visitor_name'] ?? '',
                        'furigana' => $v['furigana'] ?? '',
                        'profession' => $v['profession'] ?? '',
                        'company' => $v['company'] ?? '',
                        'email' => $v['email'] ?? '',
                        'attendance_count' => $v['attendanceCount'] ?? $v['attendance_count'] ?? '初めて',
                        'remarks' => $v['remarks'] ?? ''
                    ], ['id']);

                    $this->db->upsert('visitors_status', [
                        'visitor_id' => $vId,
                        'is_attended' => $v['isAttended'] ?? $v['is_attended'] ?? '未',
                        'is_joined' => $v['isJoined'] ?? $v['is_joined'] ?? '未',
                        'is_1to1' => $v['is1to1'] ?? $v['is_1to1'] ?? '未',
                        'is_matched' => $v['matching'] ?? $v['is_matched'] ?? '未',
                        'updated_at' => $now
                    ], ['visitor_id']);

                    $addedCount++;
                }
            }

            if (!empty($json['hearings'])) {
                foreach ($json['hearings'] as $h) {
                    $vId = (string)($h['visitorId'] ?? $h['visitor_id'] ?? '');
                    if (!$vId) continue;

                    $existing = $this->db->fetchOne("SELECT follow_memo, orient_memo FROM hearing_sheets WHERE visitor_id = ?", [$vId]);
                    $incomingFollowMemo = $h['followMemo'] ?? $h['follow_memo'] ?? '';
                    if ($incomingFollowMemo === '' && !empty($existing['follow_memo'])) {
                        $incomingFollowMemo = $existing['follow_memo'];
                    }
                    $incomingOrientMemo = $h['orientMemo'] ?? $h['orient_memo'] ?? '';
                    if ($incomingOrientMemo === '' && !empty($existing['orient_memo'])) {
                        $incomingOrientMemo = $existing['orient_memo'];
                    }

                    $this->db->upsert('hearing_sheets', [
                        'visitor_id' => $vId,
                        'orient_user' => $h['orientUser'] ?? $h['orient_user'] ?? '',
                        'q1' => $h['q1'] ?? '', 'q2' => $h['q2'] ?? '', 'q3' => $h['q3'] ?? '',
                        'q4' => $h['q4'] ?? '', 'q5' => $h['q5'] ?? '', 'q6' => $h['q6'] ?? '', 'q7' => $h['q7'] ?? '',
                        'feel_abc' => $h['feelAbc'] ?? $h['feel_abc'] ?? '',
                        'orient_memo' => $incomingOrientMemo,
                        'follow_memo' => $incomingFollowMemo,
                        'sheet_url' => $h['sheetUrl'] ?? $h['sheet_url'] ?? '',
                        'updated_at' => $h['updatedAt'] ?? $h['updated_at'] ?? $now
                    ], ['visitor_id']);
                }
            }

            if (!empty($json['members'])) {
                foreach ($json['members'] as $m) {
                    $mId = (string)($m['id'] ?? '');
                    if (!$mId) continue;

                    $this->db->upsert('members', [
                        'id' => $mId,
                        'category' => $m['category'] ?? 'その他',
                        'name' => $m['name'] ?? '',
                        'profession' => $m['profession'] ?? '',
                        'updated_at' => $now
                    ], ['id']);
                }
            }
        }

        return [
            'success' => true,
            'addedCount' => $addedCount,
            'message' => "同期完了: {$addedCount} 件のデータをSQLiteデータベースへ同期しました。"
        ];
    }

    private function fetchFromGoogleSheetsCsv(string $spreadsheetId): array {
        $visitorsRaw = $this->fetchSheetCsv($spreadsheetId, 'visitors');
        $statusRaw = $this->fetchSheetCsv($spreadsheetId, 'visitors_status');
        $hearingsRaw = $this->fetchSheetCsv($spreadsheetId, 'hearing_sheets');
        $membersRaw = $this->fetchSheetCsv($spreadsheetId, 'members');
        $listRaw = $this->fetchSheetCsv($spreadsheetId, 'List');

        $statusMap = [];
        foreach ($statusRaw as $st) {
            $vId = (string)($st['visitor_id'] ?? '');
            if ($vId !== '') {
                $statusMap[$vId] = $st;
            }
        }

        $visitors = [];
        $existingKeys = [];
        $maxId = 0;

        foreach ($visitorsRaw as $v) {
            $vId = (string)($v['id'] ?? '');
            if ($vId === '') continue;

            $numId = (int)$vId;
            if ($numId > $maxId) {
                $maxId = $numId;
            }

            $vName = $this->normalizeName($v['visitor_name'] ?? '');
            $vDate = $this->normalizeDate($v['event_date'] ?? '');
            $vEmail = $this->normalizeEmail($v['email'] ?? '');

            if ($vName && $vDate) $existingKeys["{$vName}_{$vDate}"] = true;
            if ($vEmail && $vDate) $existingKeys["{$vEmail}_{$vDate}"] = true;

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

        // Listシート（フォーム回答）から、visitorsシートにまだ入っていない新規ビジターを差分取り込み
        if (!empty($listRaw)) {
            foreach ($listRaw as $row) {
                $name = $this->normalizeName($row['氏名'] ?? $row['お名前'] ?? '');
                $rawDate = $row['参加日'] ?? $row['参加予定日'] ?? $row['日程'] ?? '';
                $eventDate = $this->normalizeDate($rawDate);
                $email = $this->normalizeEmail($row['メールアドレス'] ?? '');

                if (!$name || $name === 'テスト' || str_contains($name, '氏名') || str_contains($name, 'タイムスタンプ')) {
                    continue;
                }
                if (!$eventDate) {
                    continue;
                }

                $keyName = "{$name}_{$eventDate}";
                $keyEmail = $email ? "{$email}_{$eventDate}" : '';

                if (isset($existingKeys[$keyName]) || ($keyEmail && isset($existingKeys[$keyEmail]))) {
                    continue;
                }

                $maxId++;
                $newId = (string)$maxId;

                $existingKeys[$keyName] = true;
                if ($keyEmail) $existingKeys[$keyEmail] = true;

                $rawTs = $row['タイムスタンプ'] ?? '';
                $createdAt = $this->normalizeTimestamp($rawTs);

                $inviter = trim((string)($row['招待者'] ?? $row['ご紹介者'] ?? ''));
                $furigana = trim((string)($row['ふりがな'] ?? $row['フリガナ'] ?? ''));
                $profession = trim((string)($row['お仕事の専門分野'] ?? $row['専門分野'] ?? $row['業種'] ?? ''));
                $company = trim((string)($row['会社名'] ?? $row['屋号'] ?? ''));
                $attendanceCount = trim((string)($row['定例会へのビジター参加回数'] ?? $row['参加回数'] ?? '初めて'));

                $visitors[] = [
                    'id' => $newId,
                    'created_at' => $createdAt,
                    'inviter' => $inviter,
                    'event_date' => $eventDate,
                    'visitor_name' => $name,
                    'furigana' => $furigana,
                    'profession' => $profession,
                    'company' => $company,
                    'email' => $email,
                    'attendance_count' => $attendanceCount ?: '初めて',
                    'remarks' => '',
                    'is_attended' => '未',
                    'is_joined' => '未',
                    'is_1to1' => '未',
                    'is_matched' => '未',
                    'matching_note' => ''
                ];
            }
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

    private function normalizeName(string $name): string {
        $n = preg_replace('/[\s　]+/u', ' ', $name);
        return trim($n);
    }

    private function normalizeEmail(string $email): string {
        $e = str_replace('＠', '@', $email);
        return trim($e);
    }

    private function normalizeDate(string $rawDate): string {
        $rawDate = trim($rawDate);
        if (!$rawDate) return '';
        if (preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/', $rawDate, $m)) {
            return sprintf('%04d/%02d/%02d', $m[1], $m[2], $m[3]);
        }
        if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})/', $rawDate, $m)) {
            $year = date('Y');
            return sprintf('%04d/%02d/%02d', $year, $m[1], $m[2]);
        }
        $ts = strtotime($rawDate);
        if ($ts !== false && (int)date('Y', $ts) >= 2020) {
            return date('Y/m/d', $ts);
        }
        return $rawDate;
    }

    private function normalizeTimestamp(string $rawTs): string {
        $rawTs = trim($rawTs);
        if (!$rawTs) return date('Y/m/d H:i');
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})/', $rawTs, $m)) {
            $year = date('Y');
            return sprintf('%04d/%02d/%02d %02d:%02d', $year, $m[1], $m[2], $m[3], $m[4]);
        }
        $ts = strtotime($rawTs);
        if ($ts !== false && (int)date('Y', $ts) >= 2020) {
            return date('Y/m/d H:i', $ts);
        }
        return date('Y/m/d H:i');
    }

    private function fetchSheetCsv(string $spreadsheetId, string $sheetName): array {
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

        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $csvData);
        rewind($stream);

        $header = null;
        $rows = [];
        while (($row = fgetcsv($stream)) !== false) {
            if (empty($row) || (count($row) === 1 && $row[0] === null)) continue;
            if (!$header) {
                $header = array_map(function($h) {
                    return preg_replace('/\x{EF}\x{BB}\x{BF}/', '', trim((string)$h));
                }, $row);
            } else {
                $rowData = [];
                foreach ($header as $idx => $hName) {
                    if ($hName !== '') {
                        $val = isset($row[$idx]) ? trim((string)$row[$idx]) : '';
                        if (!isset($rowData[$hName]) || ($rowData[$hName] === '' && $val !== '')) {
                            $rowData[$hName] = $val;
                        }
                    }
                }
                $rows[] = $rowData;
            }
        }
        fclose($stream);
        return $rows;
    }
}
