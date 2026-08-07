<?php
namespace Api\Repositories;

use Api\Core\Database;

class SettingRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    public function getAll(): array {
        $rows = $this->db->fetchAll("SELECT key, value FROM settings");
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key']] = $r['value'];
        }
        if (empty($settings['start_date'])) {
            $settings['start_date'] = '2026/04/01';
        }
        return $settings;
    }

    public function getByKey(string $key, ?string $default = null): ?string {
        $value = $this->db->fetchColumn("SELECT value FROM settings WHERE key = ?", [$key]);
        return $value !== false ? $value : $default;
    }

    public function setKey(string $key, string $value, string $now): bool {
        return $this->db->upsert('settings', [
            'key' => $key,
            'value' => $value,
            'updated_at' => $now
        ], ['key']);
    }
}
