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

                    $this->db->upsert('hearing_sheets', [
                        'visitor_id' => $vId,
                        'orient_user' => $h['orientUser'] ?? $h['orient_user'] ?? '',
                        'q1' => $h['q1'] ?? '', 'q2' => $h['q2'] ?? '', 'q3' => $h['q3'] ?? '',
                        'q4' => $h['q4'] ?? '', 'q5' => $h['q5'] ?? '', 'q6' => $h['q6'] ?? '', 'q7' => $h['q7'] ?? '',
                        'feel_abc' => $h['feelAbc'] ?? $h['feel_abc'] ?? '',
                        'orient_memo' => $h['orientMemo'] ?? $h['orient_memo'] ?? '',
                        'follow_memo' => $h['followMemo'] ?? $h['follow_memo'] ?? '',
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
                        $rowData[$hName] = isset($row[$idx]) ? trim((string)$row[$idx]) : '';
                    }
                }
                $rows[] = $rowData;
            }
        }
        fclose($stream);
        return $rows;
    }
}
