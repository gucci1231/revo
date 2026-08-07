<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'get';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if ($action === 'get') {
    $stmt = $pdo->query("SELECT key, value FROM settings");
    $rows = $stmt->fetchAll();
    
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['key']] = $r['value'];
    }

    if (empty($settings['start_date'])) {
        $settings['start_date'] = '2026/04/01';
    }

    sendJsonResponse([
        'success' => true,
        'settings' => $settings
    ]);
}

if ($action === 'update') {
    $key = $input['key'] ?? '';
    $val = $input['value'] ?? '';

    if (!$key) {
        sendJsonResponse(['success' => false, 'message' => 'Key is required']);
    }

    $now = date('Y/m/d H:i');
    $stmt = $pdo->prepare("
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    ");
    $stmt->execute([$key, $val, $now]);

    sendJsonResponse([
        'success' => true,
        'key' => $key,
        'value' => $val
    ]);
}

sendJsonResponse(['success' => false, 'message' => 'Invalid action']);
