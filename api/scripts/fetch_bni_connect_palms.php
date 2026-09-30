<?php
/**
 * CLI Script: fetch_bni_connect_palms.php
 * Automated Weekly Cron script for BNI Connect PALMS crawling.
 *
 * Usage:
 *   php api/scripts/fetch_bni_connect_palms.php
 *   php api/scripts/fetch_bni_connect_palms.php --start=09/17/2026 --end=09/24/2026
 *   php api/scripts/fetch_bni_connect_palms.php --term=2
 */

require_once __DIR__ . '/../bootstrap.php';

use Api\Services\BniConnectService;
use Api\Core\Database;

$logFile = __DIR__ . '/../data/palms_sync.log';
function logMessage(string $msg) use ($logFile) {
    $time = date('Y-m-d H:i:s');
    $line = "[{$time}] {$msg}\n";
    echo $line;
    file_put_contents($logFile, $line, FILE_APPEND);
}

logMessage("=== BNI Connect PALMS Fetcher Started ===");

// Parse CLI options
$options = getopt("", ["start:", "end:", "term:", "help"]);

if (isset($options['help'])) {
    echo "Usage: php api/scripts/fetch_bni_connect_palms.php [OPTIONS]\n";
    echo "Options:\n";
    echo "  --start=MM/DD/YYYY   Start date (default: last Thursday)\n";
    echo "  --end=MM/DD/YYYY     End date (default: this Thursday)\n";
    echo "  --term=N             Fetch for specific term (1=2025/10-2026/03, 2=2026/04-2026/09)\n";
    echo "  --help               Display this help\n";
    exit(0);
}

$startDate = null;
$endDate = null;

if (isset($options['term'])) {
    $term = (int)$options['term'];
    if ($term === 1) {
        $startDate = '10/01/2025';
        $endDate = '03/31/2026';
    } elseif ($term === 2) {
        $startDate = '04/01/2026';
        $endDate = '09/30/2026';
    } else {
        logMessage("Error: Unsupported term number {$term}");
        exit(1);
    }
} elseif (isset($options['start']) && isset($options['end'])) {
    $startDate = $options['start'];
    $endDate = $options['end'];
} else {
    $range = BniConnectService::getDefaultWeeklyRange();
    $startDate = $range['startDate'];
    $endDate = $range['endDate'];
}

logMessage("Target Date Range: {$startDate} -> {$endDate}");

try {
    $service = new BniConnectService();
    $result = $service->sync($startDate, $endDate);

    logMessage("Successfully fetched {$result['recordsCount']} member records, saved {$result['savedCount']} records to SQLite.");
    logMessage("=== BNI Connect PALMS Fetcher Finished Successfully ===");
    exit(0);
} catch (Exception $e) {
    logMessage("CRITICAL ERROR: " . $e->getMessage());
    logMessage($e->getTraceAsString());
    exit(1);
}
