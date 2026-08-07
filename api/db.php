<?php
/**
 * SQLite Database Connection Bootstrap
 */
require_once __DIR__ . '/bootstrap.php';

use Api\Core\Database;

try {
    $db = Database::getInstance();
    $pdo = $db->getPdo();
} catch (Exception $e) {
    \Api\Core\Response::error('Database connection failed: ' . $e->getMessage(), 500);
}
