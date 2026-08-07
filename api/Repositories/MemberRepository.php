<?php
namespace Api\Repositories;

use Api\Core\Database;

class MemberRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAll(): array {
        return $this->db->fetchAll("SELECT id, category, name, profession FROM members ORDER BY category, name");
    }

    public function getGroupedByCategory(): array {
        $flatMembers = $this->getAll();

        $categoriesMap = [];
        foreach ($flatMembers as $m) {
            $cat = $m['category'] ?: 'その他';
            if (!isset($categoriesMap[$cat])) {
                $categoriesMap[$cat] = [];
            }
            $categoriesMap[$cat][] = $m;
        }

        $memberCategories = [];
        foreach ($categoriesMap as $cat => $members) {
            $memberCategories[] = ['category' => $cat, 'members' => $members];
        }

        return [
            'memberCategories' => $memberCategories,
            'flatMembers' => $flatMembers
        ];
    }

    public function getNextId(): string {
        $maxId = $this->db->fetchColumn("SELECT MAX(CAST(id AS INTEGER)) FROM members") ?: 0;
        return (string)($maxId + 1);
    }

    public function createMember(array $data): int {
        return $this->db->insert('members', $data);
    }

    public function updateMember(string $id, array $data): int {
        return $this->db->update('members', $data, 'id = ?', [$id]);
    }

    public function deleteMember(string $id): int {
        return $this->db->execute("DELETE FROM members WHERE id = ?", [$id]);
    }
}
