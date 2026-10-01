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
     * Save (insert or update) chapter event
     */
    public function saveChapterEvent(array $data): string {
        $now = date('Y-m-d H:i:s');
        $id = !empty($data['id']) ? (string)$data['id'] : ('ch_' . uniqid());

        $record = [
            'id' => $id,
            'title' => trim($data['title'] ?? ''),
            'category' => trim($data['category'] ?? 'チャプターイベント'),
            'start_datetime' => trim($data['start_datetime'] ?? ''),
            'end_datetime' => trim($data['end_datetime'] ?? ''),
            'location_name' => trim($data['location_name'] ?? ''),
            'location_url' => trim($data['location_url'] ?? ''),
            'is_online' => !empty($data['is_online']) ? 1 : 0,
            'organizer' => trim($data['organizer'] ?? ''),
            'description' => trim($data['description'] ?? ''),
            'updated_at' => $now
        ];

        $exists = $this->db->fetchColumn("SELECT COUNT(*) FROM chapter_events WHERE id = ?", [$id]);
        if ((int)$exists > 0) {
            $this->db->update('chapter_events', $record, "id = ?", [$id]);
        } else {
            $record['created_at'] = $now;
            $this->db->insert('chapter_events', $record);
        }

        return $id;
    }

    /**
     * Delete chapter event
     */
    public function deleteChapterEvent(string $id): bool {
        $res = $this->db->execute("DELETE FROM chapter_events WHERE id = ?", [$id]);
        return $res > 0;
    }

    /**
     * Generate regular chapter meetings for a date range (every Thursday 06:45 - 08:30)
     */
    public function getMeetingsForRange(string $startDate, string $endDate): array {
        $startTs = strtotime($startDate);
        $endTs = strtotime($endDate);
        if (!$startTs || !$endTs || $startTs > $endTs) {
            return [];
        }

        // Fetch visitor counts grouped by event_date
        $visitorCountRows = $this->db->fetchAll(
            "SELECT event_date, COUNT(*) as cnt FROM visitors WHERE event_date != '' GROUP BY event_date"
        );
        $visitorCountMap = [];
        foreach ($visitorCountRows as $row) {
            $cleanDate = str_replace('/', '-', trim($row['event_date']));
            if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $cleanDate, $m)) {
                $norm = sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3]);
                $visitorCountMap[$norm] = (int)$row['cnt'];
            }
        }

        $meetings = [];
        $cur = $startTs;
        while ($cur <= $endTs) {
            // 4 is Thursday in PHP date('w')
            if ((int)date('w', $cur) === 4) {
                $dateStr = date('Y-m-d', $cur);
                $cnt = $visitorCountMap[$dateStr] ?? 0;

                $meetings[] = [
                    'id' => 'mt_' . $dateStr,
                    'source_type' => 'meeting',
                    'title' => 'REvoチャプター 定例会',
                    'category' => '定例会',
                    'start_datetime' => $dateStr . ' 06:45:00',
                    'end_datetime' => $dateStr . ' 08:30:00',
                    'location_name' => '通常定例会会場 & Zoom',
                    'location_url' => '',
                    'is_online' => 0,
                    'organizer' => 'REvoチャプター プレジデント & 運営チーム',
                    'description' => "毎週木曜日のビジネスミーティング。ビジター参加・見学歓迎！\n6:45受付開始 / 7:00開会 / 8:30閉会",
                    'visitor_count' => $cnt
                ];
            }
            $cur = strtotime('+1 day', $cur);
        }

        return $meetings;
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

