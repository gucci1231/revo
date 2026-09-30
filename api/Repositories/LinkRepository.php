<?php
namespace Api\Repositories;

use Api\Core\Database;
use PDO;

class LinkRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAll(): array {
        $sql = "SELECT * FROM chapter_links ORDER BY sort_order ASC, created_at ASC";
        return $this->db->fetchAll($sql);
    }

    public function getById(string $id): ?array {
        $sql = "SELECT * FROM chapter_links WHERE id = ?";
        return $this->db->fetchOne($sql, [$id]);
    }

    public function save(array $data): bool {
        $id = $data['id'] ?? ('LINK_' . bin2hex(random_bytes(6)));
        $now = date('Y/m/d H:i');
        
        $linkData = [
            'id' => $id,
            'title' => (string)($data['title'] ?? ''),
            'url' => (string)($data['url'] ?? ''),
            'category' => (string)($data['category'] ?? '定例会・運営'),
            'description' => (string)($data['description'] ?? ''),
            'icon' => (string)($data['icon'] ?? 'fa-solid fa-link'),
            'sort_order' => (int)($data['sort_order'] ?? 0),
            'updated_at' => $now
        ];

        $existing = $this->getById($id);
        if ($existing) {
            return $this->db->update('chapter_links', $linkData, "id = ?", [$id]) >= 0;
        } else {
            $linkData['created_at'] = $now;
            return $this->db->insert('chapter_links', $linkData) > 0;
        }
    }

    public function delete(string $id): bool {
        return $this->db->delete('chapter_links', "id = ?", [$id]) > 0;
    }
}
