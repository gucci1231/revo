<?php
namespace Api\Repositories;

use Api\Core\Database;

class HearingRepository {
    private Database $db;
    private ?VisitorRepository $visitorRepo;

    public function __construct(?Database $db = null, ?VisitorRepository $visitorRepo = null) {
        $this->db = $db ?? Database::getInstance();
        $this->visitorRepo = $visitorRepo;
    }

    public function getAllWithVisitorInfo(): array {
        $sql = "
            SELECT 
                h.visitor_id as visitorId, 
                COALESCE(NULLIF(v.visitor_name, ''), 'ビジター No.' || h.visitor_id) as name, 
                COALESCE(v.company, '') as company, 
                COALESCE(v.profession, '') as profession, 
                COALESCE(v.inviter, '') as inviter, 
                COALESCE(NULLIF(v.event_date, ''), h.updated_at) as eventDate,
                h.orient_user as orientUser, h.q1, h.q2, h.q3, h.q4, h.q5, h.q6, h.q7, h.feel_abc as feelAbc,
                h.orient_memo as orientMemo, h.follow_memo as followMemo, h.sheet_url as sheetUrl, h.updated_at as updatedAt,
                COALESCE(s.is_attended, '未') as isAttended, COALESCE(s.is_joined, '未') as isJoined, COALESCE(s.is_1to1, '未') as is1to1
            FROM hearing_sheets h
            LEFT JOIN visitors v ON h.visitor_id = v.id
            LEFT JOIN visitors_status s ON h.visitor_id = s.visitor_id
            ORDER BY h.updated_at DESC
        ";
        return $this->db->fetchAll($sql);
    }

    public function findByVisitorId(string $visitorId): ?array {
        $visitorRepo = $this->visitorRepo ?? new VisitorRepository($this->db);
        $linkedIds = $visitorRepo->getLinkedVisitorIds($visitorId);

        if (empty($linkedIds)) {
            return $this->db->fetchOne("SELECT * FROM hearing_sheets WHERE visitor_id = ?", [$visitorId]);
        }

        $placeholders = implode(',', array_fill(0, count($linkedIds), '?'));
        $sql = "SELECT * FROM hearing_sheets WHERE visitor_id IN ({$placeholders}) ORDER BY updated_at DESC LIMIT 1";
        return $this->db->fetchOne($sql, $linkedIds);
    }

    public function saveHearingSheet(array $data): bool {
        $vId = (string)($data['visitor_id'] ?? '');
        if (!$vId) {
            return false;
        }

        $visitorRepo = $this->visitorRepo ?? new VisitorRepository($this->db);
        $linkedIds = $visitorRepo->getLinkedVisitorIds($vId);

        $success = true;
        foreach ($linkedIds as $id) {
            $row = $data;
            $row['visitor_id'] = $id;
            if (!$this->db->upsert('hearing_sheets', $row, ['visitor_id'])) {
                $success = false;
            }
        }
        return $success;
    }

    public function deleteByVisitorId(string $visitorId): int {
        return $this->db->execute("DELETE FROM hearing_sheets WHERE visitor_id = ?", [$visitorId]);
    }
}

