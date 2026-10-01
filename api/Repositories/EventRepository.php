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
}
