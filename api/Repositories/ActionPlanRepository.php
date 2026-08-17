<?php
namespace Api\Repositories;

use Api\Core\Database;

class ActionPlanRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getByVisitorId(string $visitorId): array {
        return $this->db->fetchAll(
            "SELECT * FROM action_plans WHERE visitor_id = ? ORDER BY is_completed ASC, due_date ASC, created_at DESC",
            [$visitorId]
        );
    }

    public function getAllWithVisitor(?int $isCompleted = null, int $limit = 50): array {
        $sql = "SELECT ap.*, 
                       COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
                       COALESCE(v.company, '') as visitor_company, 
                       COALESCE(v.profession, '') as visitor_profession, 
                       COALESCE(v.inviter, '') as visitor_inviter, 
                       COALESCE(v.event_date, '') as visitor_event_date
                FROM action_plans ap
                LEFT JOIN visitors v ON ap.visitor_id = v.id";
        $params = [];
        if ($isCompleted !== null) {
            $sql .= " WHERE ap.is_completed = ?";
            $params[] = $isCompleted;
        }
        $sql .= " ORDER BY ap.is_completed ASC, ap.due_date ASC, ap.created_at DESC LIMIT " . (int)$limit;
        return $this->db->fetchAll($sql, $params);
    }

    public function findById(string $id): ?array {
        $sql = "SELECT ap.*, 
                       COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || ap.visitor_id) as visitor_name, 
                       COALESCE(v.company, '') as visitor_company, 
                       COALESCE(v.profession, '') as visitor_profession, 
                       COALESCE(v.inviter, '') as visitor_inviter, 
                       COALESCE(v.event_date, '') as visitor_event_date
                FROM action_plans ap
                LEFT JOIN visitors v ON ap.visitor_id = v.id
                WHERE ap.id = ?";
        return $this->db->fetchOne($sql, [$id]);
    }

    public function getPendingCountByVisitorId(string $visitorId): int {
        return (int)$this->db->fetchColumn(
            "SELECT COUNT(*) FROM action_plans WHERE visitor_id = ? AND is_completed = 0",
            [$visitorId]
        );
    }

    public function create(array $data): string {
        $id = $data['id'] ?? ('ap_' . bin2hex(random_bytes(6)));
        $now = date('Y-m-d H:i:s');

        $this->db->insert('action_plans', [
            'id' => $id,
            'visitor_id' => $data['visitor_id'],
            'due_date' => $data['due_date'] ?? '',
            'assignee_name' => $data['assignee_name'] ?? '',
            'assignee_id' => $data['assignee_id'] ?? '',
            'action_text' => $data['action_text'],
            'report_text' => $data['report_text'] ?? '',
            'reporter_name' => $data['reporter_name'] ?? '',
            'completed_by' => $data['completed_by'] ?? '',
            'is_completed' => (int)($data['is_completed'] ?? 0),
            'completed_at' => !empty($data['is_completed']) ? $now : '',
            'created_at' => $now,
            'updated_at' => $now
        ]);

        return $id;
    }

    public function update(string $id, array $data): bool {
        $now = date('Y-m-d H:i:s');
        $updateData = ['updated_at' => $now];

        if (isset($data['due_date'])) {
            $updateData['due_date'] = $data['due_date'];
        }
        if (isset($data['assignee_name'])) {
            $updateData['assignee_name'] = $data['assignee_name'];
        }
        if (isset($data['assignee_id'])) {
            $updateData['assignee_id'] = $data['assignee_id'];
        }
        if (isset($data['action_text'])) {
            $updateData['action_text'] = $data['action_text'];
        }
        if (isset($data['report_text'])) {
            $updateData['report_text'] = $data['report_text'];
        }
        if (isset($data['reporter_name'])) {
            $updateData['reporter_name'] = $data['reporter_name'];
        }
        if (isset($data['completed_by'])) {
            $updateData['completed_by'] = $data['completed_by'];
        }
        if (isset($data['is_completed'])) {
            $updateData['is_completed'] = (int)$data['is_completed'];
            $updateData['completed_at'] = $updateData['is_completed'] === 1 ? $now : '';
        }

        return $this->db->update('action_plans', $updateData, 'id = ?', [$id]) > 0;
    }

    public function saveReport(string $id, string $reportText, string $reporterName = '', bool $markCompleted = true): ?array {
        $current = $this->findById($id);
        if (!$current) {
            return null;
        }

        $now = date('Y-m-d H:i:s');
        $isCompleted = $markCompleted ? 1 : (int)$current['is_completed'];
        $completedAt = $isCompleted === 1 ? (!empty($current['completed_at']) ? $current['completed_at'] : $now) : '';

        $this->db->update('action_plans', [
            'report_text' => $reportText,
            'reporter_name' => $reporterName ?: ($current['assignee_name'] ?: ''),
            'completed_by' => $reporterName ?: ($current['assignee_name'] ?: ''),
            'is_completed' => $isCompleted,
            'completed_at' => $completedAt,
            'updated_at' => $now
        ], 'id = ?', [$id]);

        return $this->findById($id);
    }

    public function toggleComplete(string $id, ?int $forceStatus = null): ?array {
        $current = $this->findById($id);
        if (!$current) {
            return null;
        }

        $now = date('Y-m-d H:i:s');
        $newStatus = $forceStatus !== null ? (int)$forceStatus : ((int)$current['is_completed'] === 1 ? 0 : 1);
        $completedAt = $newStatus === 1 ? (!empty($current['completed_at']) ? $current['completed_at'] : $now) : '';

        $this->db->update('action_plans', [
            'is_completed' => $newStatus,
            'completed_at' => $completedAt,
            'updated_at' => $now
        ], 'id = ?', [$id]);

        return $this->findById($id);
    }

    public function delete(string $id): bool {
        return $this->db->execute("DELETE FROM action_plans WHERE id = ?", [$id]) > 0;
    }
}
