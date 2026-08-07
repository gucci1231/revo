<?php
/**
 * SQLite Database Connection & Schema Manager
 */
header('Content-Type: application/json; charset=utf-8');

$dbDir = __DIR__ . '/data';
if (!file_exists($dbDir)) {
    mkdir($dbDir, 0755, true);
}

$dbFile = $dbDir . '/database.sqlite';

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Enable WAL mode for high concurrency & speed
    $pdo->exec("PRAGMA journal_mode = WAL;");

    // Initialize Schema
    $pdo->exec("
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

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

function sendJsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
