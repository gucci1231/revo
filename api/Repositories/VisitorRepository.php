<?php
namespace Api\Repositories;

use Api\Core\Database;

class VisitorRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAllWithStatusAndHearing(): array {
        $sql = "
            SELECT 
                v.id, v.created_at as createdDate, COALESCE(v.inviter, '') as inviter, v.event_date as eventDate, 
                COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name, 
                COALESCE(v.furigana, '') as furigana, 
                COALESCE(v.profession, '') as profession, 
                COALESCE(v.company, '') as company, 
                COALESCE(v.email, '') as email, 
                v.attendance_count as attendanceCount, v.remarks,
                COALESCE(s.is_attended, '未') as isAttended,
                COALESCE(s.is_joined, '未') as isJoined,
                COALESCE(s.is_1to1, '未') as is1to1,
                COALESCE(s.is_matched, '未') as matching,
                CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet,
                COALESCE(h.sheet_url, '') as hearingUrl,
                COALESCE(h.feel_abc, '') as feelAbc,
                COALESCE(h.q7, '') as q7,
                COALESCE(h.orient_user, '') as orientUser,
                COALESCE(h.orient_memo, '') as orientMemo
            FROM visitors v
            LEFT JOIN visitors_status s ON v.id = s.visitor_id
            LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
            ORDER BY v.event_date DESC
        ";
        return $this->db->fetchAll($sql);
    }

    public function findById(string $id): ?array {
        return $this->db->fetchOne("SELECT * FROM visitors WHERE id = ?", [$id]);
    }

    public function getLinkedVisitorIds(string $visitorId): array {
        $v = $this->findById($visitorId);
        if (!$v) return [$visitorId];

        $email = trim($v['email'] ?? '');
        $name = trim($v['visitor_name'] ?? '');
        $cleanName = preg_replace('/[\s\x{3000}]+/u', '', $name);

        if (!$email && (mb_strlen($cleanName) <= 1 || preg_match('/^ビジター\s*(no\.?\s*\d+)?$/iu', $name))) {
            return [$visitorId];
        }

        $params = [];
        $conditions = [];

        if ($email !== '') {
            $conditions[] = "LOWER(TRIM(email)) = LOWER(?)";
            $params[] = $email;
        }

        if ($cleanName !== '') {
            $conditions[] = "REPLACE(REPLACE(visitor_name, ' ', ''), '　', '') = ?";
            $params[] = $cleanName;
        }

        if (empty($conditions)) return [$visitorId];

        $sql = "SELECT id FROM visitors WHERE " . implode(" OR ", $conditions);
        $rows = $this->db->fetchAll($sql, $params);
        $ids = array_map(fn($r) => (string)$r['id'], $rows);
        $ids[] = (string)$visitorId;
        return array_values(array_unique($ids));
    }

    public function getVisitsByVisitorIds(array $visitorIds): array {
        if (empty($visitorIds)) return [];
        $placeholders = implode(',', array_fill(0, count($visitorIds), '?'));
        $sql = "
            SELECT 
                v.id,
                v.created_at as createdAt,
                COALESCE(v.inviter, '') as inviter,
                COALESCE(v.event_date, '') as eventDate,
                COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name,
                COALESCE(v.furigana, '') as furigana,
                COALESCE(v.profession, '') as profession,
                COALESCE(v.company, '') as company,
                COALESCE(v.email, '') as email,
                COALESCE(v.attendance_count, '初めて') as attendanceCount,
                COALESCE(v.remarks, '') as remarks,
                COALESCE(s.is_attended, '未') as isAttended,
                COALESCE(s.is_joined, '未') as isJoined,
                COALESCE(s.is_1to1, '未') as is1to1,
                COALESCE(s.is_matched, '未') as matching
            FROM visitors v
            LEFT JOIN visitors_status s ON v.id = s.visitor_id
            WHERE v.id IN ({$placeholders})
            ORDER BY v.event_date ASC, CAST(v.id AS INTEGER) ASC
        ";
        return $this->db->fetchAll($sql, $visitorIds);
    }

    public function getStatusByVisitorId(string $visitorId): ?array {
        $linkedIds = $this->getLinkedVisitorIds($visitorId);
        if (empty($linkedIds)) {
            return $this->db->fetchOne("SELECT * FROM visitors_status WHERE visitor_id = ?", [$visitorId]);
        }

        $placeholders = implode(',', array_fill(0, count($linkedIds), '?'));
        $rows = $this->db->fetchAll("SELECT * FROM visitors_status WHERE visitor_id IN ({$placeholders}) ORDER BY updated_at DESC", $linkedIds);

        if (empty($rows)) {
            return [
                'visitor_id' => $visitorId,
                'is_attended' => '未',
                'is_joined' => '未',
                'is_1to1' => '未',
                'is_matched' => '未'
            ];
        }

        $merged = $rows[0];
        $merged['visitor_id'] = $visitorId;

        foreach ($rows as $r) {
            if (($r['is_attended'] ?? '') === '参加') $merged['is_attended'] = '参加';
            if (($r['is_joined'] ?? '') === '入会済' || ($r['is_joined'] ?? '') === '済') $merged['is_joined'] = '入会済';
            if (($r['is_1to1'] ?? '') === '済') $merged['is_1to1'] = '済';
            if (($r['is_matched'] ?? '') === '成功') $merged['is_matched'] = '成功';
        }

        return $merged;
    }

    public function getNextId(): string {
        $maxId = $this->db->fetchColumn("SELECT MAX(CAST(id AS INTEGER)) FROM visitors") ?: 0;
        return (string)($maxId + 1);
    }

    public function createVisitor(array $data): string {
        $this->db->insert('visitors', $data);
        return $data['id'];
    }

    public function createInitialStatus(string $visitorId, string $now): void {
        $this->db->insert('visitors_status', [
            'visitor_id' => $visitorId,
            'updated_at' => $now
        ]);
    }

    public function updateStatus(string $visitorId, string $column, string $value, string $now): bool {
        $linkedIds = $this->getLinkedVisitorIds($visitorId);
        $success = true;

        foreach ($linkedIds as $id) {
            $ok = $this->db->upsert('visitors_status', [
                'visitor_id' => $id,
                $column => $value,
                'updated_at' => $now
            ], ['visitor_id']);
            if (!$ok) $success = false;
        }

        return $success;
    }

    public function updateRemarks(string $visitorId, string $remarks): int {
        return $this->db->update('visitors', ['remarks' => $remarks], 'id = ?', [$visitorId]);
    }

    public function deleteVisitor(string $visitorId): void {
        $this->db->execute("DELETE FROM visitors WHERE id = ?", [$visitorId]);
        $this->db->execute("DELETE FROM visitors_status WHERE visitor_id = ?", [$visitorId]);
        $this->db->execute("DELETE FROM hearing_sheets WHERE visitor_id = ?", [$visitorId]);
    }

    public function getDashboardVisitors(): array {
        $sql = "
            SELECT 
                v.id, 
                COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || v.id) as name, 
                COALESCE(v.furigana, '') as furigana, 
                COALESCE(v.company, '') as company, 
                COALESCE(v.profession, '') as profession, 
                COALESCE(v.inviter, '') as inviter, 
                COALESCE(v.event_date, '') as eventDate,
                COALESCE(v.attendance_count, '初めて') as attendanceCount,
                COALESCE(s.is_attended, '未') as isAttended,
                COALESCE(s.is_joined, '未') as isJoined,
                COALESCE(s.is_1to1, '未') as is1to1,
                COALESCE(s.is_matched, '未') as matching,
                COALESCE(h.feel_abc, '') as feelAbc,
                COALESCE(h.q7, '') as q7,
                COALESCE(h.orient_user, '') as orientUser,
                COALESCE(h.orient_memo, '') as orientMemo,
                COALESCE(h.follow_memo, '') as followMemo,
                CASE WHEN h.visitor_id IS NOT NULL THEN 1 ELSE 0 END as hasHearingSheet
            FROM visitors v
            LEFT JOIN visitors_status s ON v.id = s.visitor_id
            LEFT JOIN hearing_sheets h ON v.id = h.visitor_id
            ORDER BY v.event_date DESC, v.id DESC
        ";
        return $this->db->fetchAll($sql);
    }
}
