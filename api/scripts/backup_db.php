<?php
/**
 * SQLite Database Backup & Rotation Script
 * 
 * 毎日実行され、database.sqlite をトランザクション安全にバックアップします。
 * 7日以上経過した古いバックアップファイルは自動的に削除されます。
 */

declare(strict_types=1);

// CLI 実行、または内部実行のみを許可
if (php_sapi_name() !== 'cli' && (!isset($_GET['token']) || $_GET['token'] !== 'revo_secure_backup_key')) {
    header('HTTP/1.1 403 Forbidden');
    echo "Access denied.\n";
    exit(1);
}

$baseDir = dirname(__DIR__); // api/
$dataDir = $baseDir . '/data';
$dbPath = $dataDir . '/database.sqlite';
$backupDir = $dataDir . '/backups';
$retentionDays = 7; // 保持日数

echo "[" . date('Y-m-d H:i:s') . "] Starting SQLite database backup...\n";

// 1. DBファイルの存在確認
if (!file_exists($dbPath)) {
    fwrite(STDERR, "Error: Source database file not found at: {$dbPath}\n");
    exit(1);
}

// 2. バックアップディレクトリの作成（存在しない場合）
if (!is_dir($backupDir)) {
    if (!mkdir($backupDir, 0755, true) && !is_dir($backupDir)) {
        fwrite(STDERR, "Error: Failed to create backup directory: {$backupDir}\n");
        exit(1);
    }
}

// 3. バックアップファイル名の決定 (例: database_2026-08-24_040000.sqlite)
$timestamp = date('Y-m-d_His');
$backupFileName = "database_{$timestamp}.sqlite";
$backupFilePath = $backupDir . '/' . $backupFileName;

// 4. 安全なバックアップ実行
$backupSuccess = false;

// 方式A: SQLite3 拡張の backup() メソッド (最も安全で無停止)
if (class_exists('SQLite3')) {
    try {
        $source = new SQLite3($dbPath, SQLITE3_OPEN_READONLY);
        $dest = new SQLite3($backupFilePath, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
        if (method_exists($source, 'backup')) {
            $source->backup($dest);
            $backupSuccess = true;
        }
        $dest->close();
        $source->close();
    } catch (Throwable $e) {
        fwrite(STDERR, "SQLite3::backup() warning: " . $e->getMessage() . "\n");
    }
}

// 方式B: VACUUM INTO によるバックアップ (SQLite 3.27+)
if (!$backupSuccess) {
    try {
        $pdo = new PDO("sqlite:{$dbPath}");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $escapedPath = str_replace("'", "''", $backupFilePath);
        $pdo->exec("VACUUM INTO '{$escapedPath}'");
        $backupSuccess = true;
    } catch (Throwable $e) {
        fwrite(STDERR, "VACUUM INTO warning: " . $e->getMessage() . "\n");
    }
}

// 方式C: sqlite3 CLI コマンド
if (!$backupSuccess && function_exists('exec')) {
    $cmd = sprintf("sqlite3 %s \".backup '%s'\"", escapeshellarg($dbPath), escapeshellarg($backupFilePath));
    exec($cmd, $output, $returnVar);
    if ($returnVar === 0 && file_exists($backupFilePath) && filesize($backupFilePath) > 0) {
        $backupSuccess = true;
    }
}

// 方式D: 最終フォールバックとしてのファイルコピー
if (!$backupSuccess) {
    if (copy($dbPath, $backupFilePath)) {
        $backupSuccess = true;
    } else {
        fwrite(STDERR, "Error: Failed to copy database file to backup location.\n");
        exit(1);
    }
}

// 5. バックアップファイルの整合性検証
if (!file_exists($backupFilePath) || filesize($backupFilePath) === 0) {
    fwrite(STDERR, "Error: Backup file is empty or missing: {$backupFilePath}\n");
    exit(1);
}

$fp = fopen($backupFilePath, 'rb');
$header = fread($fp, 16);
fclose($fp);

if (strpos($header, 'SQLite format 3') !== 0) {
    fwrite(STDERR, "Error: Backup file header corrupted (not a valid SQLite 3 database).\n");
    @unlink($backupFilePath);
    exit(1);
}

$fileSizeKb = round(filesize($backupFilePath) / 1024, 2);
echo "[SUCCESS] Backup created successfully: {$backupFileName} ({$fileSizeKb} KB)\n";

// 6. 7日以上前の古いバックアップファイルのクリーンアップ（ローテーション）
$deletedCount = 0;
$cutoffTime = time() - ($retentionDays * 86400);

$files = glob($backupDir . '/database_*.sqlite');
if ($files !== false) {
    foreach ($files as $file) {
        // 現在作成したばかりのファイルはスキップ
        if ($file === $backupFilePath) {
            continue;
        }

        $mtime = filemtime($file);
        if ($mtime < $cutoffTime) {
            $baseName = basename($file);
            if (@unlink($file)) {
                echo "[CLEANUP] Deleted old backup: {$baseName} (created on " . date('Y-m-d H:i:s', $mtime) . ")\n";
                $deletedCount++;
            } else {
                fwrite(STDERR, "[WARNING] Failed to delete old backup: {$baseName}\n");
            }
        }
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Backup process completed. Retention: {$retentionDays} days, Old files removed: {$deletedCount}\n";
exit(0);
