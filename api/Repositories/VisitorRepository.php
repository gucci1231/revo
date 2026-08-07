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

    public function getStatusByVisitorId(string $visitorId): ?array {
        return $this->db->fetchOne("SELECT * FROM visitors_status WHERE visitor_id = ?", [$visitorId]);
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
        return $this->db->upsert('visitors_status', [
            'visitor_id' => $visitorId,
            $column => $value,
            'updated_at' => $now
        ], ['visitor_id']);
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
