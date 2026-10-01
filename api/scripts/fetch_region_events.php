<?php
/**
 * CLI Script: fetch_region_events.php
 * Automated Weekly Cron script for BNI Kyoto City Central event crawling.
 *
 * Usage:
 *   php api/scripts/fetch_region_events.php
 *   php api/scripts/fetch_region_events.php --days-back=14 --months-ahead=3
 *   php api/scripts/fetch_region_events.php --no-details
 */

require_once __DIR__ . '/../bootstrap.php';

use Api\Services\RegionEventService;
use Api\Core\Database;

$logFile = __DIR__ . '/../data/events_sync.log';
function logEventMessage(string $msg): void {
    global $logFile;
    $time = date('Y-m-d H:i:s');
    $line = "[{$time}] {$msg}\n";
    echo $line;
    @file_put_contents($logFile, $line, FILE_APPEND);
}

logEventMessage("=== BNI Kyoto City Central Events Fetcher Started ===");

// Parse CLI options
$options = getopt("", ["days-back:", "months-ahead:", "no-details", "help"]);

if (isset($options['help'])) {
    echo "Usage: php api/scripts/fetch_region_events.php [OPTIONS]\n";
    echo "Options:\n";
    echo "  --days-back=N        Days back to fetch (default: 30)\n";
    echo "  --months-ahead=N     Months ahead to fetch (default: 6)\n";
    echo "  --no-details         Skip fetching detailed pages (faster)\n";
    echo "  --help               Display this help\n";
    exit(0);
}

$daysBack = isset($options['days-back']) ? (int)$options['days-back'] : 30;
$monthsAhead = isset($options['months-ahead']) ? (int)$options['months-ahead'] : 6;
$fetchDetails = !isset($options['no-details']);

logEventMessage("Config: daysBack={$daysBack}, monthsAhead={$monthsAhead}, fetchDetails=" . ($fetchDetails ? 'true' : 'false'));

try {
    $service = new RegionEventService();
    $result = $service->sync($daysBack, $monthsAhead, $fetchDetails, function($curr, $total, $title) {
        if ($curr % 5 === 0 || $curr === $total) {
            logEventMessage("[{$curr}/{$total}] Synced: {$title}");
        }
    });

    logEventMessage("Completed! Total fetched: {$result['totalFetched']}, New saved: {$result['savedCount']}, Updated: {$result['updatedCount']}");
    logEventMessage("=== BNI Kyoto City Central Events Fetcher Finished Successfully ===");
    exit(0);
} catch (Exception $e) {
    logEventMessage("CRITICAL ERROR: " . $e->getMessage());
    logEventMessage($e->getTraceAsString());
    exit(1);
}
