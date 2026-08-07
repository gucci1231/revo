<?php
namespace Api\Core;

use PDO;
use Exception;

/**
 * DRY SQLite Database Driver
 * Handles connection, schema setup, CRUD operations, Upserts, and Transactions.
 */
class Database {
    private static ?Database $instance = null;
    private PDO $pdo;

    public function __construct(?string $dbPath = null) {
        $dbPath = $dbPath ?? __DIR__ . '/../data/database.sqlite';
        $dir = dirname($dbPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Enable WAL mode for high concurrency & speed
        $this->pdo->exec("PRAGMA journal_mode = WAL;");

        $this->initSchema();
    }

    public static function getInstance(?string $dbPath = null): Database {
        if (self::$instance === null) {
            self::$instance = new Database($dbPath);
        }
        return self::$instance;
    }

    public function getPdo(): PDO {
        return $this->pdo;
    }

    private function initSchema(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS visitors (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                inviter TEXT,
                event_date TEXT,
                visitor_name TEXT,
                furigana TEXT,
                profession TEXT,
                company TEXT,
                email TEXT,
                attendance_count TEXT DEFAULT '初めて',
                remarks TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS visitors_status (
                visitor_id TEXT PRIMARY KEY,
                is_attended TEXT DEFAULT '未',
                is_joined TEXT DEFAULT '未',
                is_1to1 TEXT DEFAULT '未',
                is_matched TEXT DEFAULT '未',
                matching_note TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS hearing_sheets (
                visitor_id TEXT PRIMARY KEY,
                orient_user TEXT DEFAULT '',
                q1 TEXT DEFAULT '',
                q2 TEXT DEFAULT '',
                q3 TEXT DEFAULT '',
                q4 TEXT DEFAULT '',
                q5 TEXT DEFAULT '',
                q6 TEXT DEFAULT '',
                q7 TEXT DEFAULT '',
                feel_abc TEXT DEFAULT '',
                orient_memo TEXT DEFAULT '',
                follow_memo TEXT DEFAULT '',
                sheet_url TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                category TEXT DEFAULT 'その他',
                name TEXT,
                profession TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            );
        ");
    }

    public function fetchOne(string $sql, array $params = []): ?array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    public function fetchAll(string $sql, array $params = []): array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function fetchColumn(string $sql, array $params = []): mixed {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    public function execute(string $sql, array $params = []): int {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function insert(string $table, array $data): int {
        $cols = array_keys($data);
        $placeholders = array_fill(0, count($cols), '?');
        $sql = sprintf(
            "INSERT INTO %s (%s) VALUES (%s)",
            $table,
            implode(', ', $cols),
            implode(', ', $placeholders)
        );
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_values($data));
        return $stmt->rowCount();
    }

    public function update(string $table, array $data, string $where, array $whereParams = []): int {
        $sets = array_map(fn($col) => "{$col} = ?", array_keys($data));
        $sql = sprintf(
            "UPDATE %s SET %s WHERE %s",
            $table,
            implode(', ', $sets),
            $where
        );
        $params = array_merge(array_values($data), $whereParams);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function upsert(string $table, array $data, array $uniqueKeys): bool {
        $cols = array_keys($data);
        $placeholders = array_fill(0, count($cols), '?');
        
        $updateCols = array_diff($cols, $uniqueKeys);
        $updateSets = array_map(fn($col) => "{$col} = excluded.{$col}", $updateCols);

        $sql = sprintf(
            "INSERT INTO %s (%s) VALUES (%s) ON CONFLICT(%s) DO UPDATE SET %s",
            $table,
            implode(', ', $cols),
            implode(', ', $placeholders),
            implode(', ', $uniqueKeys),
            implode(', ', $updateSets)
        );

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute(array_values($data));
    }

    public function transaction(callable $callback): mixed {
        $this->pdo->beginTransaction();
        try {
            $result = $callback($this);
            $this->pdo->commit();
            return $result;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
