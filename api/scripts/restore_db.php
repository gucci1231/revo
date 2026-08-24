<?php
/**
 * SQLite Database Restore Tool (CLI Only)
 * 
 * 過去のバックアップから database.sqlite を復元します。
 * 復元直前の現行DBも念のため自動退避されます。
 */

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    header('HTTP/1.1 403 Forbidden');
    echo "Access denied. CLI only.\n";
    exit(1);
}

$baseDir = dirname(__DIR__); // api/
$dataDir = $baseDir . '/data';
$dbPath = $dataDir . '/database.sqlite';
$backupDir = $dataDir . '/backups';

echo "========================================\n";
echo "  Visitor Host Revo - SQLite DB Restore Tool\n";
echo "========================================\n\n";

if (!is_dir($backupDir)) {
    echo "Error: Backup directory does not exist: {$backupDir}\n";
    exit(1);
}

$files = glob($backupDir . '/database_*.sqlite');
if (empty($files)) {
    echo "No backup files found in {$backupDir}\n";
    exit(1);
}

// 新しい順にソート
usort($files, function($a, $b) {
    return filemtime($b) - filemtime($a);
});

$targetFile = null;

// 引数でファイル名またはフルパスが指定されている場合
if (isset($argv[1])) {
    $arg = $argv[1];
    if (file_exists($arg)) {
        $targetFile = realpath($arg);
    } else if (file_exists($backupDir . '/' . $arg)) {
        $targetFile = realpath($backupDir . '/' . $arg);
    } else {
        echo "Error: Specified backup file not found: {$arg}\n";
        exit(1);
    }
} else {
    // 一覧表示
    echo "Available Backups:\n";
    foreach ($files as $idx => $file) {
        $num = $idx + 1;
        $name = basename($file);
        $size = round(filesize($file) / 1024, 2) . ' KB';
        $mtime = date('Y-m-d H:i:s', filemtime($file));
        echo "  [{$num}] {$name}  ({$size}, {$mtime})\n";
    }
    echo "\nEnter the number of the backup to restore (or 'q' to quit): ";
    $input = trim(fgets(STDIN));

    if ($input === 'q' || $input === '') {
        echo "Restore cancelled.\n";
        exit(0);
    }

    $selectedIdx = (int)$input - 1;
    if (!isset($files[$selectedIdx])) {
        echo "Invalid selection.\n";
        exit(1);
    }

    $targetFile = $files[$selectedIdx];
}

$targetName = basename($targetFile);
echo "\nTarget backup: {$targetName}\n";
echo "Are you sure you want to restore this database? (yes/no): ";
$confirm = trim(fgets(STDIN));

if (strtolower($confirm) !== 'yes' && strtolower($confirm) !== 'y') {
    echo "Restore cancelled.\n";
    exit(0);
}

// 1. 現行DBの自動退避
if (file_exists($dbPath)) {
    $emergencyBackup = $dataDir . '/database.sqlite.before_restore_' . date('Y-m-d_His');
    if (copy($dbPath, $emergencyBackup)) {
        echo "[SAFETY] Current database saved to: " . basename($emergencyBackup) . "\n";
    } else {
        echo "[WARNING] Could not create emergency backup of current database.\n";
    }
}

// 2. 復元実行
if (copy($targetFile, $dbPath)) {
    // 3. 整合性チェック
    try {
        $pdo = new PDO("sqlite:{$dbPath}");
        $stmt = $pdo->query("SELECT count(*) FROM visitors;");
        $visitorCount = $stmt ? $stmt->fetchColumn() : 'N/A';
        echo "\n[SUCCESS] Database successfully restored from {$targetName}!\n";
        echo "Verified visitor count: {$visitorCount}\n";
        exit(0);
    } catch (Throwable $e) {
        echo "\n[WARNING] Database copied, but verification query failed: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "\n[ERROR] Failed to restore database file.\n";
    exit(1);
}
