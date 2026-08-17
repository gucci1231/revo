<?php
namespace Api\Repositories;

use Api\Core\Database;

class EmailTemplateRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAll(): array {
        return $this->db->fetchAll("SELECT * FROM email_templates ORDER BY CASE 
            WHEN category = 'welcome' THEN 1
            WHEN category = 'remind' THEN 2
            WHEN category = 'thanks' THEN 3
            WHEN category = 'follow' THEN 4
            ELSE 5 END, id ASC");
    }

    public function getById(string $id): ?array {
        return $this->db->fetchOne("SELECT * FROM email_templates WHERE id = ?", [$id]);
    }

    public function update(string $id, string $subject, string $body): bool {
        $now = date('Y/m/d H:i');
        $this->db->upsert('email_templates', [
            'id' => $id,
            'subject' => $subject,
            'body' => $body,
            'updated_at' => $now
        ], ['id']);
        return true;
    }
}
