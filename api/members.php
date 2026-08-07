<?php
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'list';
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

if ($action === 'list') {
    $stmt = $pdo->query("SELECT id, category, name, profession FROM members ORDER BY category, name");
    $flatMembers = $stmt->fetchAll();

    $categoriesMap = [];
    foreach ($flatMembers as $m) {
        $cat = $m['category'] ?: 'その他';
        if (!isset($categoriesMap[$cat])) $categoriesMap[$cat] = [];
        $categoriesMap[$cat][] = $m;
    }

    $memberCategories = [];
    foreach ($categoriesMap as $cat => $members) {
        $memberCategories[] = ['category' => $cat, 'members' => $members];
    }

    sendJsonResponse(['success' => true, 'memberCategories' => $memberCategories, 'flatMembers' => $flatMembers]);
}

if ($action === 'add') {
    $maxId = $pdo->query("SELECT MAX(CAST(id AS INTEGER)) FROM members")->fetchColumn() ?: 0;
    $newId = (string)($maxId + 1);
    $now = date('Y/m/d H:i');

    $stmt = $pdo->prepare("INSERT INTO members (id, category, name, profession, updated_at) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$newId, $input['category'] ?? 'その他', $input['name'] ?? '', $input['profession'] ?? '', $now]);

    header('Location: members.php?action=list');
    exit;
}

if ($action === 'update') {
    $mId = $input['id'] ?? '';
    $now = date('Y/m/d H:i');

    $stmt = $pdo->prepare("UPDATE members SET category = ?, name = ?, profession = ?, updated_at = ? WHERE id = ?");
    $stmt->execute([$input['category'] ?? 'その他', $input['name'] ?? '', $input['profession'] ?? '', $now, $mId]);

    header('Location: members.php?action=list');
    exit;
}

if ($action === 'delete') {
    $mId = $input['id'] ?? $_GET['id'] ?? '';

    $stmt = $pdo->prepare("DELETE FROM members WHERE id = ?");
    $stmt->execute([$mId]);

    header('Location: members.php?action=list');
    exit;
}

sendJsonResponse(['success' => false, 'message' => 'Invalid action']);
