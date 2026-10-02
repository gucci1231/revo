<?php
namespace Api\Repositories;

use Api\Core\Database;
use PDO;

class LinkRepository {
    private Database $db;

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
        $this->ensureCategoriesTable();
    }

    private function ensureCategoriesTable(): void {
        $sql = "CREATE TABLE IF NOT EXISTS chapter_link_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            icon TEXT DEFAULT 'fa-solid fa-folder',
            sort_order INTEGER DEFAULT 0,
            scope TEXT DEFAULT 'member',
            created_at TEXT,
            updated_at TEXT
        )";
        $this->db->execute($sql);

        // Migrate legacy categories in chapter_links if present
        $this->migrateLegacyCategories();
    }

    private function migrateLegacyCategories(): void {
        $count = (int)$this->db->fetchColumn("SELECT COUNT(*) FROM chapter_link_categories");
        if ($count === 0) {
            $now = date('Y/m/d H:i');
            $initialCategories = [
                ['id' => 'CAT_VISITOR', 'name' => 'ビジター情報', 'icon' => 'fa-solid fa-user-plus', 'sort_order' => 10, 'scope' => 'member'],
                ['id' => 'CAT_MEMBER', 'name' => 'メンバー情報', 'icon' => 'fa-solid fa-users', 'sort_order' => 20, 'scope' => 'member'],
                ['id' => 'CAT_LEARN', 'name' => '公式ポータル・学び', 'icon' => 'fa-solid fa-graduation-cap', 'sort_order' => 30, 'scope' => 'member'],
                ['id' => 'CAT_ADMIN', 'name' => '役員・チャプター運営', 'icon' => 'fa-solid fa-user-gear', 'sort_order' => 40, 'scope' => 'admin'],
                ['id' => 'CAT_ASSETS', 'name' => 'アセット関連', 'icon' => 'fa-solid fa-folder-open', 'sort_order' => 50, 'scope' => 'member'],
                ['id' => 'CAT_ARCHIVE', 'name' => 'アーカイブ', 'icon' => 'fa-solid fa-box-archive', 'sort_order' => 60, 'scope' => 'archive'],
            ];

            foreach ($initialCategories as $cat) {
                $this->db->insert('chapter_link_categories', [
                    'id' => $cat['id'],
                    'name' => $cat['name'],
                    'icon' => $cat['icon'],
                    'sort_order' => $cat['sort_order'],
                    'scope' => $cat['scope'],
                    'created_at' => $now,
                    'updated_at' => $now
                ]);
            }
        }

        // Migrate links from legacy categories
        // 1. ビジター・入会 -> ビジター情報
        $this->db->execute("UPDATE chapter_links SET category = 'ビジター情報' WHERE category = 'ビジター・入会'");

        // 2. アセット関連 items: 1to1シートマスター、略歴シートマスター、名札、写真、ZOOM背景、ロゴ、定例会スライド
        $assetIds = ['LINK_002', 'LINK_004', 'LINK_005', 'LINK_009', 'LINK_021', 'LINK_023', 'LINK_024'];
        $inClause = "'" . implode("','", $assetIds) . "'";
        $this->db->execute("UPDATE chapter_links SET category = 'アセット関連' WHERE id IN ($inClause)");

        // 3. 残りの日常・1to1 -> メンバー情報
        $this->db->execute("UPDATE chapter_links SET category = 'メンバー情報' WHERE category = '日常・1to1'");
    }

    public function getAll(): array {
        $sql = "SELECT * FROM chapter_links ORDER BY sort_order ASC, created_at ASC";
        return $this->db->fetchAll($sql);
    }

    public function getCategories(): array {
        $sql = "SELECT * FROM chapter_link_categories ORDER BY sort_order ASC, name ASC";
        $cats = $this->db->fetchAll($sql);
        if (empty($cats)) {
            $this->ensureCategoriesTable();
            $cats = $this->db->fetchAll($sql);
        }
        return $cats;
    }

    public function getById(string $id): ?array {
        $sql = "SELECT * FROM chapter_links WHERE id = ?";
        return $this->db->fetchOne($sql, [$id]);
    }

    public function save(array $data): bool {
        $id = $data['id'] ?? ('LINK_' . bin2hex(random_bytes(6)));
        $now = date('Y/m/d H:i');
        
        $category = (string)($data['category'] ?? 'メンバー情報');
        $scope = trim((string)($data['scope'] ?? ''));
        if ($scope === '') {
            $catRow = $this->db->fetchOne("SELECT scope FROM chapter_link_categories WHERE name = ?", [$category]);
            if ($catRow && !empty($catRow['scope'])) {
                $scope = $catRow['scope'];
            } else if ($category === '役員・チャプター運営') {
                $scope = 'admin';
            } else if ($category === 'アーカイブ') {
                $scope = 'archive';
            } else {
                $scope = 'member';
            }
        }

        $linkData = [
            'id' => $id,
            'title' => (string)($data['title'] ?? ''),
            'url' => (string)($data['url'] ?? ''),
            'category' => $category,
            'scope' => $scope,
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

    public function saveCategory(array $data): bool {
        $id = $data['id'] ?? ('CAT_' . bin2hex(random_bytes(6)));
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') return false;

        $now = date('Y/m/d H:i');
        $catData = [
            'name' => $name,
            'icon' => (string)($data['icon'] ?? 'fa-solid fa-folder'),
            'sort_order' => (int)($data['sort_order'] ?? 0),
            'scope' => (string)($data['scope'] ?? 'member'),
            'updated_at' => $now
        ];

        $existing = $this->db->fetchOne("SELECT * FROM chapter_link_categories WHERE id = ? OR name = ?", [$id, $name]);
        if ($existing) {
            $catId = $existing['id'];
            $oldName = $existing['name'];
            $ok = $this->db->update('chapter_link_categories', $catData, "id = ?", [$catId]) >= 0;
            if ($ok && $oldName !== $name) {
                // Also update any links using the old category name
                $this->db->execute("UPDATE chapter_links SET category = ? WHERE category = ?", [$name, $oldName]);
            }
            // Update scope of linked items to match updated category scope
            $this->db->execute("UPDATE chapter_links SET scope = ? WHERE category = ?", [$catData['scope'], $name]);
            return $ok;
        } else {
            $catData['id'] = $id;
            $catData['created_at'] = $now;
            return $this->db->insert('chapter_link_categories', $catData) > 0;
        }
    }

    public function deleteCategory(string $idOrName): bool {
        $cat = $this->db->fetchOne("SELECT * FROM chapter_link_categories WHERE id = ? OR name = ?", [$idOrName, $idOrName]);
        if (!$cat) return false;

        // Reassign affected links to 'メンバー情報'
        $this->db->execute("UPDATE chapter_links SET category = 'メンバー情報' WHERE category = ?", [$cat['name']]);
        return $this->db->delete('chapter_link_categories', "id = ?", [$cat['id']]) > 0;
    }

    public function reorderLinks(array $items): bool {
        // items: array of ['id' => '...', 'sort_order' => 1, 'category' => '...']
        $pdo = $this->db->getPdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE chapter_links SET sort_order = ?, category = COALESCE(?, category), updated_at = ? WHERE id = ?");
            $now = date('Y/m/d H:i');
            foreach ($items as $item) {
                if (!isset($item['id'])) continue;
                $sort = (int)($item['sort_order'] ?? 0);
                $cat = isset($item['category']) ? (string)$item['category'] : null;
                $stmt->execute([$sort, $cat, $now, $item['id']]);
            }
            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return false;
        }
    }

    public function reorderCategories(array $items): bool {
        // items: array of ['name' => '...', 'sort_order' => 10] or ['id' => '...', 'sort_order' => 10]
        $pdo = $this->db->getPdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("UPDATE chapter_link_categories SET sort_order = ?, updated_at = ? WHERE id = ? OR name = ?");
            $now = date('Y/m/d H:i');
            foreach ($items as $item) {
                $key = (string)($item['id'] ?? $item['name'] ?? '');
                if ($key === '') continue;
                $sort = (int)($item['sort_order'] ?? 0);
                $stmt->execute([$sort, $now, $key, $key]);
            }
            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            return false;
        }
    }
}
