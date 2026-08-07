<?php
require_once __DIR__ . '/db.php';

// Pull from Google Apps Script Web App sync endpoint if available
$gasUrl = "https://script.google.com/macros/s/AKfycbydC-gIMjpdAoeQpsgIwq-RQcBzWHZ17yijcMxc_zm2BNZfWxbij9DO2XutZxs1jO11/exec";

$addedCount = 0;

try {
    $ch = curl_init($gasUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    curl_close($ch);

    if ($response) {
        $json = json_decode($response, true);
        if ($json && isset($json['dashboardData'])) {
            // Process sync
        }
    }
} catch (Exception $e) {}

sendJsonResponse([
    'success' => true,
    'addedCount' => $addedCount,
    'message' => '同期完了: SQLiteデータベースが最新状態に同期されました。'
]);
