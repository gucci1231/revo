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

                    // 1. visitors テーブル: 既存レコードがあれば空項目で上書きしない
                    $existingVisitor = $this->db->fetchOne("SELECT id, remarks FROM visitors WHERE id = ?", [$vId]);
                    if (!$existingVisitor) {
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
                    }

                    // 2. visitors_status テーブル: SQLiteが正 (Master)。既存ステータスは絶対に上書きしない！
                    $existingStatus = $this->db->fetchOne("SELECT visitor_id FROM visitors_status WHERE visitor_id = ?", [$vId]);
                    if (!$existingStatus) {
                        $this->db->upsert('visitors_status', [
                            'visitor_id' => $vId,
                            'is_attended' => $v['isAttended'] ?? $v['is_attended'] ?? '未',
                            'is_joined' => $v['isJoined'] ?? $v['is_joined'] ?? '未',
                            'is_1to1' => $v['is1to1'] ?? $v['is_1to1'] ?? '未',
                            'is_matched' => $v['matching'] ?? $v['is_matched'] ?? '未',
                            'matching_note' => $v['matching_note'] ?? '',
                            'updated_at' => $now
                        ], ['visitor_id']);
                    }

                    $addedCount++;
                }
            }

            if (!empty($json['hearings'])) {
                foreach ($json['hearings'] as $h) {
                    $vId = (string)($h['visitorId'] ?? $h['visitor_id'] ?? '');
                    if (!$vId) continue;

                    $existing = $this->db->fetchOne("SELECT orient_user, q1, q2, q3, q4, q5, q6, q7, feel_abc, orient_memo, follow_memo, sheet_url FROM hearing_sheets WHERE visitor_id = ?", [$vId]);
                    if (!$existing) {
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
                    } else {
                        // 既存データがある場合は、スプレッドシート側が空でない項目のみマージ
                        $updateData = [];
                        if (empty($existing['feel_abc']) && !empty($h['feelAbc'] ?? $h['feel_abc'])) {
                            $updateData['feel_abc'] = $h['feelAbc'] ?? $h['feel_abc'];
                        }
                        if (empty($existing['orient_user']) && !empty($h['orientUser'] ?? $h['orient_user'])) {
                            $updateData['orient_user'] = $h['orientUser'] ?? $h['orient_user'];
                        }
                        if (!empty($updateData)) {
                            $updateData['visitor_id'] = $vId;
                            $updateData['updated_at'] = $now;
                            $this->db->upsert('hearing_sheets', $updateData, ['visitor_id']);
                        }
                    }
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

            if (!empty($json['email_templates'])) {
                foreach ($json['email_templates'] as $t) {
                    $tId = (string)($t['id'] ?? $t['key'] ?? '');
                    if (!$tId) continue;

                    $this->db->upsert('email_templates', [
                        'id' => $tId,
                        'name' => $t['name'] ?? $tId,
                        'category' => $t['category'] ?? 'welcome',
                        'subject' => $t['subject'] ?? '',
                        'body' => $t['body'] ?? '',
                        'description' => $t['description'] ?? '',
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
            $inviter = $this->normalizeMemberName((string)($v['inviter'] ?? ''), $membersRaw);
            $visitors[] = [
                'id' => $vId,
                'created_at' => $v['created_at'] ?? '',
                'inviter' => $inviter,
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

                $rawInviter = trim((string)($row['招待者'] ?? $row['ご紹介者'] ?? ''));
                $inviter = $this->normalizeMemberName($rawInviter, $membersRaw);
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

        $templatesRaw = $this->fetchSheetCsv($spreadsheetId, 'FollowMail_template');
        $emailTemplates = [];
        if (!empty($templatesRaw)) {
            foreach ($templatesRaw as $tRow) {
                $key = trim((string)($tRow['Key'] ?? ''));
                if (!$key || $key === 'Key') continue;

                $subject = trim((string)($tRow['Subject'] ?? ''));
                $body = trim((string)($tRow['Template'] ?? ''));
                $desc = trim((string)($tRow['Description'] ?? ''));

                $meta = $this->getTemplateMetadata($key);

                $emailTemplates[] = [
                    'id' => $key,
                    'name' => $meta['name'],
                    'category' => $meta['category'],
                    'subject' => $subject,
                    'body' => $body,
                    'description' => $desc ?: $meta['description']
                ];

                // フロントエンド標準キーへのエイリアスも同期
                if (!empty($meta['aliases'])) {
                    foreach ($meta['aliases'] as $aliasKey) {
                        $emailTemplates[] = [
                            'id' => $aliasKey,
                            'name' => $meta['name'],
                            'category' => $meta['category'],
                            'subject' => $subject,
                            'body' => $body,
                            'description' => $desc ?: $meta['description']
                        ];
                    }
                }
            }
        }

        return [
            'visitors' => $visitors,
            'hearings' => $hearings,
            'members' => $members,
            'email_templates' => $emailTemplates
        ];
    }

    private function getTemplateMetadata(string $key): array {
        $map = [
            'EMAIL_INTRO' => [
                'name' => '新規ビジター参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '初めてお申し込みいただいたビジター様へ送信する初回案内メールです。',
                'aliases' => ['EMAIL_VISITOR_INTRO']
            ],
            'EMAIL_GUEST_INTRO' => [
                'name' => '他チャプターゲスト参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '他チャプターからゲスト参加されるメンバー様向けの参加案内メールです。',
                'aliases' => []
            ],
            'EMAIL_URGENT' => [
                'name' => '直前参加申込案内 (Welcome)',
                'category' => 'welcome',
                'description' => '開催直前にお申し込みいただいた方向けの特急案内メールです。',
                'aliases' => []
            ],
            'EMAIL_2DAYS_AGO' => [
                'name' => '定例会 2日前リマインド',
                'category' => 'remind',
                'description' => '定例会開催の2日前に事前準備や日程のリマインドとして送信するメールです。',
                'aliases' => ['EMAIL_REMIND_2DAYS']
            ],
            'EMAIL_PREV_DAY' => [
                'name' => '定例会 前日リマインド',
                'category' => 'remind',
                'description' => '定例会開催の前日に最終確認として送信するメールです。',
                'aliases' => ['EMAIL_REMIND_1DAY']
            ],
            'EMAIL_THANK_YOU' => [
                'name' => '定例会ご参加御礼メール (出席)',
                'category' => 'thanks',
                'description' => '定例会に参加いただいたビジター様へ当日に送信するお礼メールです。',
                'aliases' => ['EMAIL_THANKS_ATTENDED']
            ],
            'EMAIL_THANK_YOU_REPEAT' => [
                'name' => '再参加リピーターご参加御礼メール',
                'category' => 'thanks',
                'description' => '2回目以降の参加となるリピーター様へ当日に送信する御礼メールです。',
                'aliases' => ['EMAIL_REPEATER_INTRO']
            ],
            'EMAIL_ABSENT' => [
                'name' => '定例会欠席フォローメール',
                'category' => 'thanks',
                'description' => '定例会を欠席されたビジター様へお見舞いと次回案内を兼ねて送信するメールです。',
                'aliases' => ['EMAIL_THANKS_ABSENT']
            ],
            'EMAIL_GUEST_THANKS' => [
                'name' => 'ゲスト参加御礼メール',
                'category' => 'thanks',
                'description' => '他チャプターゲスト様へ当日に送信する御礼メールです。',
                'aliases' => []
            ],
            'EMAIL_AFTER_FOLLOW_7' => [
                'name' => '参加1週間後フォローメール',
                'category' => 'follow',
                'description' => '参加から1週間が経過したタイミングで送信するフォローメールです。',
                'aliases' => ['EMAIL_FOLLOW_7DAYS']
            ],
            'EMAIL_ABSENT_FOLLOW_7' => [
                'name' => '欠席1週間後フォローメール',
                'category' => 'follow',
                'description' => '欠席から1週間後に状況伺いとして送信するフォローメールです。',
                'aliases' => []
            ],
            'EMAIL_AFTER_FOLLOW_30' => [
                'name' => '参加1ヶ月後フォローメール',
                'category' => 'follow',
                'description' => '参加から1ヶ月後にビジネスの進捗確認や再参加を促すフォローメールです。',
                'aliases' => ['EMAIL_FOLLOW_30DAYS']
            ],
            'EMAIL_ABSENT_FOLLOW_30' => [
                'name' => '欠席1ヶ月後フォローメール',
                'category' => 'follow',
                'description' => '欠席から1ヶ月後に定期的なお伺いとして送信するフォローメールです。',
                'aliases' => []
            ]
        ];

        if (isset($map[$key])) {
            return $map[$key];
        }

        return [
            'name' => $key,
            'category' => 'welcome',
            'description' => '',
            'aliases' => []
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

    private function normalizeMemberName(string $rawName, array $members): string {
        $raw = trim($rawName);
        if ($raw === '' || $raw === '-') {
            return $raw;
        }

        // 敬称（さん・様・さま・氏・君・くん・先生・社長・代表など）の除去
        $cleaned = preg_replace('/[\s\x{3000}]*(?:さん|様|さま|氏|君|くん|先生|社長|代表)$/u', '', $raw);
        $cleaned = trim($cleaned);
        if ($cleaned === '') {
            return $raw;
        }

        $cleanKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $cleaned));
        $cleanHira = mb_convert_kana($cleanKey, 'c', 'UTF-8');

        // 1. 完全一致 (スペース無視)
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
            if ($cleanKey === $mKey) {
                return $mName;
            }
        }

        // 2. 既知の同音・漢字エイリアス / ひらがな辞書一致
        $aliases = [
            '小瀬戸 健一' => ['小瀬戸', 'おぜと', 'おせど', '小瀬', '瀬戸', 'こせど'],
            '前井 宏之' => ['前井', 'まえい', '前居', '前居宏之'],
            '平田 貴嗣' => ['平田', 'ひらた', '平田たかつぐ', 'たかつぐ'],
            '上田 優也' => ['上田', 'うえだ', '植田', 'ゆうや'],
            '小山 世次' => ['小山', 'こやま', 'おやま', '世次', 'せいじ'],
            '阿部 真二' => ['阿部', 'あべ', '安倍', '安部', '真二', 'しんじ'],
            '三島 文美' => ['三島', 'みしま', '文美', 'あやみ'],
            '永井 創太' => ['永井', 'ながい', '長井', '創太', 'そうた'],
            '森田 由美子' => ['森田', 'もりた', '盛田', '由美子', 'ゆみこ'],
            '川田 湧矢' => ['川田', 'かわた', 'かわだ', '河田', '湧矢'],
            '板谷 栄子' => ['板谷', 'いたや', '板屋', '栄子', 'えいこ'],
            '桐原 卓也' => ['桐原', 'きりはら', '桐山', '卓也', 'たくや'],
            '川口 陽平' => ['川口', 'かわぐち', '河口', '陽平', 'ようへい', 'ぐっち'],
            '江幡 幸典' => ['江幡', '江端', 'えばた', '江端幸典', '江端ゆきのり', '幸典', 'ゆきのり', 'エバタ'],
            '居原田 晃司' => ['居原田', 'いはらだ', '井原田', '猪原田', '晃司', 'こうじ'],
            '熊野 りん' => ['熊野', 'くまの', 'りん'],
            '畑中 実' => ['畑中', 'はたなか', '実', 'みのる'],
            '野本 暁' => ['野本', 'のもと', '暁', 'あきら'],
            '佐内 勖' => ['佐内', 'さない', '左内'],
            '松本 俊輔' => ['松本', 'まつもと', '俊輔', 'しゅんすけ']
        ];

        foreach ($aliases as $canonical => $aliasList) {
            foreach ($aliasList as $a) {
                $aKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $a));
                $aHira = mb_convert_kana($aKey, 'c', 'UTF-8');
                if ($cleanKey === $aKey || $cleanHira === $aHira) {
                    return $canonical;
                }
            }
        }

        // 3. 姓一致 (苗字が一致し、該当者が1名の場合)
        $lastNameMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $parts = preg_split('/[\s\x{3000}]+/u', $mName);
            $lastName = mb_strtolower($parts[0] ?? '');
            if ($lastName !== '' && $cleanKey === $lastName) {
                $lastNameMatches[] = $mName;
            }
        }
        if (count($lastNameMatches) === 1) {
            return $lastNameMatches[0];
        }

        // 4. 名一致 (名前が一致し、該当者が1名の場合)
        $firstNameMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $parts = preg_split('/[\s\x{3000}]+/u', $mName);
            if (count($parts) > 1) {
                $firstName = mb_strtolower(implode('', array_slice($parts, 1)));
                if ($firstName !== '' && $cleanKey === $firstName) {
                    $firstNameMatches[] = $mName;
                }
            }
        }
        if (count($firstNameMatches) === 1) {
            return $firstNameMatches[0];
        }

        // 5. 部分一致
        $partialMatches = [];
        foreach ($members as $m) {
            $mName = trim($m['name'] ?? $m['氏名'] ?? '');
            $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
            if (str_contains($mKey, $cleanKey) || str_contains($cleanKey, $mKey)) {
                $partialMatches[] = $mName;
            }
        }
        if (count($partialMatches) === 1) {
            return $partialMatches[0];
        }

        // 6. 類似度（編集距離）マッチング
        if (mb_strlen($cleanKey) >= 2) {
            $typoMatches = [];
            foreach ($members as $m) {
                $mName = trim($m['name'] ?? $m['氏名'] ?? '');
                $mKey = mb_strtolower(preg_replace('/[\s\x{3000}]+/u', '', $mName));
                $parts = preg_split('/[\s\x{3000}]+/u', $mName);
                $lastName = mb_strtolower($parts[0] ?? '');

                $distFull = levenshtein($cleanKey, $mKey);
                $distLast = levenshtein($cleanKey, $lastName);

                if ($distFull <= 1 || ($distLast <= 1 && mb_strlen($cleanKey) >= 2)) {
                    $typoMatches[] = $mName;
                }
            }
            if (count($typoMatches) === 1) {
                return $typoMatches[0];
            }
        }

        return $cleaned;
    }
}
