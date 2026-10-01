<?php
namespace Api\Repositories;

use Api\Core\Database;

class EventRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Get list of events with flexible filtering
     */
    public function getList(array $filters = []): array {
        $conditions = [];
        $params = [];

        // Scope: 'upcoming' (default), 'past', 'all', or specific month YYYY-MM
        $scope = $filters['scope'] ?? 'upcoming';
        $now = date('Y-m-d H:i:s');

        if ($scope === 'upcoming') {
            $conditions[] = "start_datetime >= ?";
            $params[] = date('Y-m-d 00:00:00'); // include today's events
        } elseif ($scope === 'past') {
            $conditions[] = "start_datetime < ?";
            $params[] = date('Y-m-d 00:00:00');
        } elseif (preg_match('/^\d{4}-\d{2}$/', $scope)) {
            $conditions[] = "start_datetime LIKE ?";
            $params[] = $scope . '%';
        }

        // Event Type / Category filter
        if (!empty($filters['event_type_name'])) {
            $conditions[] = "event_type_name = ?";
            $params[] = $filters['event_type_name'];
        } elseif (!empty($filters['category'])) {
            $conditions[] = "(event_type_name = ? OR title LIKE ?)";
            $params[] = $filters['category'];
            $params[] = '%' . $filters['category'] . '%';
        }

        // Online or In-person
        if (isset($filters['is_online']) && $filters['is_online'] !== '') {
            $conditions[] = "is_online = ?";
            $params[] = (int)$filters['is_online'];
        }

        // Keyword search
        if (!empty($filters['keyword'])) {
            $conditions[] = "(title LIKE ? OR description LIKE ? OR location_name LIKE ? OR contact_name LIKE ?)";
            $kw = '%' . $filters['keyword'] . '%';
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $order = ($scope === 'past') ? 'DESC' : 'ASC';
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : 150;

        $sql = "SELECT * FROM region_events {$whereClause} ORDER BY start_datetime {$order} LIMIT {$limit}";
        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Get single event by ID
     */
    public function getById(int $id): ?array {
        $sql = "SELECT * FROM region_events WHERE id = ?";
        return $this->db->fetchOne($sql, [$id]);
    }

    /**
     * Get distinct categories (event_type_name)
     */
    public function getCategories(): array {
        $sql = "SELECT DISTINCT event_type_name FROM region_events WHERE event_type_name != '' ORDER BY event_type_name ASC";
        $rows = $this->db->fetchAll($sql);
        return array_column($rows, 'event_type_name');
    }

    /**
     * Get distinct months (YYYY-MM) with event counts
     */
    public function getMonths(): array {
        $sql = "SELECT substr(start_datetime, 1, 7) as month_val, COUNT(*) as cnt 
                FROM region_events 
                GROUP BY month_val 
                ORDER BY month_val ASC";
        return $this->db->fetchAll($sql);
    }

    /**
     * Get summary KPI statistics
     */
    public function getSummary(): array {
        $now = date('Y-m-d H:i:s');
        $currentMonth = date('Y-m');

        $totalUpcoming = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM region_events WHERE start_datetime >= ?", [$now]);
        $currentMonthTotal = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM region_events WHERE start_datetime LIKE ?", [$currentMonth . '%']);
        $onlineCount = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM region_events WHERE start_datetime >= ? AND is_online = 1", [$now]);
        $inPersonCount = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM region_events WHERE start_datetime >= ? AND is_online = 0", [$now]);

        $nextEvent = $this->db->fetchOne("SELECT * FROM region_events WHERE start_datetime >= ? ORDER BY start_datetime ASC LIMIT 1", [$now]);

        $lastSyncedAt = $this->db->fetchColumn("SELECT value FROM settings WHERE `key` = 'last_events_synced_at'") ?: null;

        return [
            'totalUpcoming' => $totalUpcoming,
            'currentMonthTotal' => $currentMonthTotal,
            'onlineCount' => $onlineCount,
            'inPersonCount' => $inPersonCount,
            'nextEvent' => $nextEvent,
            'lastSyncedAt' => $lastSyncedAt
        ];
    }

    /**
     * Get list of chapter events
     */
    public function getChapterEvents(array $filters = []): array {
        $conditions = [];
        $params = [];

        $scope = $filters['scope'] ?? 'all';
        $now = date('Y-m-d 00:00:00');

        if ($scope === 'upcoming') {
            $conditions[] = "start_datetime >= ?";
            $params[] = $now;
        } elseif ($scope === 'past') {
            $conditions[] = "start_datetime < ?";
            $params[] = $now;
        } elseif (preg_match('/^\d{4}-\d{2}$/', $scope)) {
            $conditions[] = "start_datetime LIKE ?";
            $params[] = $scope . '%';
        }

        if (!empty($filters['month'])) {
            $conditions[] = "start_datetime LIKE ?";
            $params[] = $filters['month'] . '%';
        }

        if (!empty($filters['category'])) {
            $conditions[] = "category = ?";
            $params[] = $filters['category'];
        }

        if (isset($filters['is_online']) && $filters['is_online'] !== '') {
            $conditions[] = "is_online = ?";
            $params[] = (int)$filters['is_online'];
        }

        if (!empty($filters['keyword'])) {
            $conditions[] = "(title LIKE ? OR description LIKE ? OR location_name LIKE ? OR organizer LIKE ?)";
            $kw = '%' . $filters['keyword'] . '%';
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
            $params[] = $kw;
        }

        $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
        $sql = "SELECT * FROM chapter_events {$whereClause} ORDER BY start_datetime ASC";
        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Get single chapter event
     */
    public function getChapterEventById(string $id): ?array {
        $sql = "SELECT * FROM chapter_events WHERE id = ?";
        return $this->db->fetchOne($sql, [$id]);
    }

    /**
     * Save (insert, update, or recurring batch create) chapter event(s)
     */
    public function saveChapterEvent(array $data): array {
        $now = date('Y-m-d H:i:s');
        $id = !empty($data['id']) ? (string)$data['id'] : ('ch_' . uniqid());
        $repeatRule = $data['recurrence_rule'] ?? ($data['repeat_type'] ?? 'none');
        $repeatUntil = $data['recurrence_until'] ?? ($data['repeat_until'] ?? '');
        $repeatCount = (int)($data['recurrence_count'] ?? ($data['repeat_count'] ?? 0));

        $baseRecord = [
            'title' => trim($data['title'] ?? ''),
            'category' => trim($data['category'] ?? 'チャプターイベント'),
            'location_name' => trim($data['location_name'] ?? ''),
            'location_url' => trim($data['location_url'] ?? ''),
            'is_online' => !empty($data['is_online']) ? 1 : 0,
            'organizer' => trim($data['organizer'] ?? ''),
            'description' => trim($data['description'] ?? ''),
            'recurrence_rule' => $repeatRule,
            'updated_at' => $now
        ];

        // If recurring creation is requested for new event
        if (empty($data['id']) && in_array($repeatRule, ['weekdays', 'daily', 'weekly', 'biweekly', 'monthly'], true)) {
            $groupId = 'rec_' . uniqid();
            $startDt = trim($data['start_datetime'] ?? '');
            $endDt = trim($data['end_datetime'] ?? '');

            $startTime = strlen($startDt) >= 11 ? substr($startDt, 11) : '00:00:00';
            $endTime = strlen($endDt) >= 11 ? substr($endDt, 11) : '';
            $startDateStr = substr($startDt, 0, 10);

            $startTs = strtotime($startDateStr);
            if (!$startTs) {
                $startTs = time();
            }

            $untilTs = !empty($repeatUntil) ? strtotime($repeatUntil) : strtotime('+3 months', $startTs);
            if (!$untilTs || $untilTs < $startTs) {
                $untilTs = strtotime('+3 months', $startTs);
            }

            $maxCount = $repeatCount > 0 ? min($repeatCount, 120) : 120;
            $createdCount = 0;
            $firstId = '';
            $currentTs = $startTs;

            // If weekdays and starting date falls on weekend, advance to next Monday
            if ($repeatRule === 'weekdays') {
                while ((int)date('N', $currentTs) >= 6) {
                    $currentTs = strtotime('+1 day', $currentTs);
                }
            }

            $stepIndex = 0;

            while ($stepIndex < $maxCount && $currentTs <= $untilTs) {
                $dateStr = date('Y-m-d', $currentTs);
                $curStartDt = $dateStr . ($startTime ? ' ' . $startTime : ' 00:00:00');
                $curEndDt = ($endTime && $endTime !== '') ? ($dateStr . ' ' . $endTime) : '';

                $curId = 'ch_' . uniqid() . '_' . $stepIndex;
                if ($stepIndex === 0) {
                    $firstId = $curId;
                }

                $record = array_merge($baseRecord, [
                    'id' => $curId,
                    'start_datetime' => $curStartDt,
                    'end_datetime' => $curEndDt,
                    'recurrence_group_id' => $groupId,
                    'recurrence_rule' => $repeatRule,
                    'created_at' => $now
                ]);

                $this->db->insert('chapter_events', $record);
                $createdCount++;
                $stepIndex++;

                if ($repeatRule === 'weekdays') {
                    do {
                        $currentTs = strtotime('+1 day', $currentTs);
                    } while ((int)date('N', $currentTs) >= 6);
                } elseif ($repeatRule === 'daily') {
                    $currentTs = strtotime('+1 day', $currentTs);
                } elseif ($repeatRule === 'weekly') {
                    $currentTs = strtotime('+1 week', $currentTs);
                } elseif ($repeatRule === 'biweekly') {
                    $currentTs = strtotime('+2 weeks', $currentTs);
                } elseif ($repeatRule === 'monthly') {
                    $currentTs = strtotime('+1 month', $currentTs);
                } else {
                    break;
                }
            }

            return [
                'id' => $firstId ?: $id,
                'count' => $createdCount,
                'group_id' => $groupId,
                'is_recurring' => true
            ];
        }

        // Single event creation or update
        $record = array_merge($baseRecord, [
            'id' => $id,
            'start_datetime' => trim($data['start_datetime'] ?? ''),
            'end_datetime' => trim($data['end_datetime'] ?? ''),
            'recurrence_group_id' => $data['recurrence_group_id'] ?? ''
        ]);

        $exists = $this->db->fetchColumn("SELECT COUNT(*) FROM chapter_events WHERE id = ?", [$id]);
        if ((int)$exists > 0) {
            $this->db->update('chapter_events', $record, "id = ?", [$id]);
        } else {
            $record['created_at'] = $now;
            $this->db->insert('chapter_events', $record);
        }

        return [
            'id' => $id,
            'count' => 1,
            'group_id' => $record['recurrence_group_id'],
            'is_recurring' => false
        ];
    }

    /**
     * Delete chapter event (single or entire recurring series)
     */
    public function deleteChapterEvent(string $id, bool $deleteSeries = false): bool {
        if ($deleteSeries) {
            $groupId = $this->db->fetchColumn("SELECT recurrence_group_id FROM chapter_events WHERE id = ?", [$id]);
            if (!empty($groupId)) {
                $res = $this->db->execute("DELETE FROM chapter_events WHERE recurrence_group_id = ?", [$groupId]);
                return $res > 0;
            }
        }

        $res = $this->db->execute("DELETE FROM chapter_events WHERE id = ?", [$id]);
        return $res > 0;
    }

    /**
     * Generate regular chapter meetings for a date range (every Thursday 06:45 - 08:30) with customizations
     */
    public function getMeetingsForRange(string $startDate, string $endDate): array {
        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        if (!$startTs || !$endTs || $startTs > $endTs) {
            return [];
        }

        // Fetch visitors grouped by event_date
        $visitorRows = $this->db->fetchAll(
            "SELECT v.id, v.event_date, v.visitor_name, v.furigana, v.company, v.profession, v.inviter, 
                    COALESCE(v.category, 'ビジター') as category, 
                    COALESCE(s.is_attended, '未') as is_attended,
                    COALESCE(s.is_joined, '未') as is_joined
             FROM visitors v
             LEFT JOIN visitors_status s ON v.id = s.visitor_id
             WHERE v.event_date != ''
             ORDER BY CAST(v.id AS INTEGER) ASC"
        );
        $visitorsMap = [];
        foreach ($visitorRows as $row) {
            $cleanDate = str_replace('/', '-', trim($row['event_date']));
            if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $cleanDate, $m)) {
                $norm = sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
                if (!isset($visitorsMap[$norm])) {
                    $visitorsMap[$norm] = [];
                }
                $visitorsMap[$norm][] = [
                    'id' => (string)$row['id'],
                    'name' => $row['visitor_name'] ?: ('ビジター No.' . $row['id']),
                    'furigana' => $row['furigana'] ?? '',
                    'company' => $row['company'] ?? '',
                    'profession' => $row['profession'] ?? '',
                    'inviter' => $row['inviter'] ?? '',
                    'category' => $row['category'] ?? 'ビジター',
                    'is_attended' => $row['is_attended'] ?? '未',
                    'is_joined' => $row['is_joined'] ?? '未'
                ];
            }
        }

        // Fetch meeting customizations in this range
        $customRows = [];
        try {
            $customRows = $this->db->fetchAll(
                "SELECT * FROM meeting_customizations WHERE meeting_date >= ? AND meeting_date <= ?",
                [$startDate, $endDate]
            );
        } catch (\Exception $e) {}

        $customMap = [];
        foreach ($customRows as $cr) {
            $customMap[$cr['meeting_date']] = $cr;
        }

        $meetings = [];
        $cur = $startTs;
        while ($cur <= $endTs) {
            $dateStr = date('Y-m-d', $cur);
            $isThursday = ((int)date('w', $cur) === 4);
            $hasCustom = isset($customMap[$dateStr]);

            // Include if Thursday or if explicitly customized
            if ($isThursday || $hasCustom) {
                $dayVisitors = $visitorsMap[$dateStr] ?? [];
                $cnt = count($dayVisitors);
                $custom = $customMap[$dateStr] ?? null;

                $meetings[] = [
                    'id' => 'mt_' . $dateStr,
                    'meeting_date' => $dateStr,
                    'source_type' => 'meeting',
                    'title' => $custom ? ($custom['title'] ?: 'REvoチャプター 定例会') : 'REvoチャプター 定例会',
                    'category' => $custom ? ($custom['category'] ?: '定例会') : '定例会',
                    'start_datetime' => $custom && !empty($custom['start_datetime']) ? $custom['start_datetime'] : ($dateStr . ' 06:00:00'),
                    'end_datetime' => $custom && !empty($custom['end_datetime']) ? $custom['end_datetime'] : ($dateStr . ' 08:30:00'),
                    'location_name' => $custom ? ($custom['location_name'] ?? 'Zoom') : 'Zoom',
                    'location_url' => $custom ? ($custom['location_url'] ?? '') : '',
                    'is_online' => $custom ? (int)$custom['is_online'] : 1, // 定例会は基本Zoomのみ
                    'organizer' => $custom ? ($custom['organizer'] ?: 'REvoチャプター プレジデント & 運営チーム') : 'REvoチャプター プレジデント & 運営チーム',
                    'description' => $custom ? ($custom['description'] ?: "毎週木曜日のビジネスミーティング。ビジター参加・見学歓迎！\nメンバー 6:00 / ビジター 6:40 受付開始 / 7:00 開会 / 8:30 閉会") : "毎週木曜日のビジネスミーティング。ビジター参加・見学歓迎！\nメンバー 6:00 / ビジター 6:40 受付開始 / 7:00 開会 / 8:30 閉会",
                    'visitor_count' => $cnt,
                    'visitors' => $dayVisitors,
                    'is_customized' => $custom ? 1 : 0
                ];
            }
            $cur = strtotime('+1 day', $cur);
        }

        return $meetings;
    }

    /**
     * Save meeting customization
     */
    public function saveMeetingCustomization(array $data): array {
        $meetingDate = trim($data['meeting_date'] ?? '');
        if (empty($meetingDate)) {
            throw new \InvalidArgumentException('定例会の日付が指定されていません');
        }

        $now = date('Y-m-d H:i:s');
        $record = [
            'meeting_date' => $meetingDate,
            'title' => trim($data['title'] ?? 'REvoチャプター 定例会'),
            'category' => trim($data['category'] ?? '定例会'),
            'is_online' => !empty($data['is_online']) ? 1 : 0,
            'location_name' => trim($data['location_name'] ?? ''),
            'location_url' => trim($data['location_url'] ?? ''),
            'start_datetime' => trim($data['start_datetime'] ?? ($meetingDate . ' 06:00:00')),
            'end_datetime' => trim($data['end_datetime'] ?? ($meetingDate . ' 08:30:00')),
            'organizer' => trim($data['organizer'] ?? 'REvoチャプター プレジデント & 運営チーム'),
            'description' => trim($data['description'] ?? ''),
            'updated_at' => $now
        ];

        $exists = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM meeting_customizations WHERE meeting_date = ?", [$meetingDate]);
        if ($exists > 0) {
            $this->db->update('meeting_customizations', $record, "meeting_date = ?", [$meetingDate]);
        } else {
            $record['created_at'] = $now;
            $this->db->insert('meeting_customizations', $record);
        }

        return [
            'success' => true,
            'meeting_date' => $meetingDate,
            'customization' => $record
        ];
    }

    /**
     * Reset/Delete meeting customization (restore default)
     */
    public function resetMeetingCustomization(string $meetingDate): bool {
        if (empty($meetingDate)) {
            return false;
        }
        $res = $this->db->execute("DELETE FROM meeting_customizations WHERE meeting_date = ?", [$meetingDate]);
        return $res > 0;
    }

    /**
     * Get unified calendar events for a month or period
     */
    public function getAllCalendarEvents(string $yearMonth = '', array $filters = []): array {
        if (empty($yearMonth) || !preg_match('/^\d{4}-\d{2}$/', $yearMonth)) {
            $yearMonth = date('Y-m');
        }

        $firstDay = $yearMonth . '-01';
        $lastDay = date('Y-m-t', strtotime($firstDay));

        // Extend by 7 days before and after to cover the full calendar month view grid
        $startRange = date('Y-m-d', strtotime('-7 days', strtotime($firstDay)));
        $endRange = date('Y-m-d', strtotime('+7 days', strtotime($lastDay)));

        // 1. Regular Meetings
        $meetings = $this->getMeetingsForRange($startRange, $endRange);

        // 2. Chapter Events
        $chapterRows = $this->db->fetchAll(
            "SELECT * FROM chapter_events WHERE start_datetime >= ? AND start_datetime <= ? ORDER BY start_datetime ASC",
            [$startRange . ' 00:00:00', $endRange . ' 23:59:59']
        );
        $chapterEvents = array_map(function($ev) {
            $ev['source_type'] = 'chapter';
            return $ev;
        }, $chapterRows);

        // 3. Region Training Events
        $trainingRows = $this->db->fetchAll(
            "SELECT * FROM region_events WHERE start_datetime >= ? AND start_datetime <= ? ORDER BY start_datetime ASC",
            [$startRange . ' 00:00:00', $endRange . ' 23:59:59']
        );
        $trainingEvents = array_map(function($ev) {
            $ev['source_type'] = 'training';
            $ev['category'] = $ev['event_type_name'] ?: 'トレーニング';
            return $ev;
        }, $trainingRows);

        // Merge all events
        $all = array_merge($meetings, $chapterEvents, $trainingEvents);

        // Sort by start_datetime ASC
        usort($all, function($a, $b) {
            return strcmp($a['start_datetime'], $b['start_datetime']);
        });

        // Apply filters if present
        if (!empty($filters['source_type'])) {
            $all = array_values(array_filter($all, fn($e) => $e['source_type'] === $filters['source_type']));
        }
        if (!empty($filters['format'])) {
            if ($filters['format'] === 'online') {
                $all = array_values(array_filter($all, fn($e) => !empty($e['is_online'])));
            } elseif ($filters['format'] === 'inperson') {
                $all = array_values(array_filter($all, fn($e) => empty($e['is_online'])));
            }
        }
        if (!empty($filters['keyword'])) {
            $kw = mb_strtolower($filters['keyword']);
            $all = array_values(array_filter($all, function($e) use ($kw) {
                return (
                    str_contains(mb_strtolower($e['title'] ?? ''), $kw) ||
                    str_contains(mb_strtolower($e['description'] ?? ''), $kw) ||
                    str_contains(mb_strtolower($e['location_name'] ?? ''), $kw) ||
                    str_contains(mb_strtolower($e['category'] ?? ''), $kw) ||
                    str_contains(mb_strtolower($e['organizer'] ?? ''), $kw)
                );
            }));
        }

        return $all;
    }
}

