<?php
/**
 * 定期レポート・通知自動配信スクリプト (Xserver Cron用)
 *
 * 実行例 (Cron設定: 毎時または毎10分):
 * php /home/xs489303/k-d-o.biz/public_html/revo.k-d-o.biz/api/scripts/send_scheduled_reports.php
 *
 * 強制実行テスト:
 * php send_scheduled_reports.php --force=weekly_visitor_status
 */

date_default_timezone_set('Asia/Tokyo');

require_once __DIR__ . '/../bootstrap.php';

use Api\Repositories\ReportTemplateRepository;
use Api\Services\MailService;
use Api\Services\ReportContextService;

$templateRepo = new ReportTemplateRepository();
$mailService = new MailService();
$contextService = new ReportContextService();

// コマンドライン引数のパース
$forceTemplateId = null;
foreach ($argv as $arg) {
    if (strpos($arg, '--force=') === 0) {
        $forceTemplateId = substr($arg, 8);
    }
}

$now = new DateTime('now', new DateTimeZone('Asia/Tokyo'));
$currentDay = $now->format('D'); // Sun, Mon, Tue, etc.
$currentHour = intval($now->format('H'));
$currentMinute = intval($now->format('i'));
$todayDateStr = $now->format('Y-m-d');

echo "[" . $now->format('Y-m-d H:i:s') . "] Scheduled Report Runner Started.\n";

// 送信履歴ログファイルの読み込み（1日1回制限用）
$logFile = __DIR__ . '/../data/report_sent_log.json';
$sentLog = [];
if (file_exists($logFile)) {
    $raw = @file_get_contents($logFile);
    $sentLog = json_decode($raw, true) ?: [];
}

// 過去7日分以外をクリーンアップ
$cleanLog = [];
$cutoff = date('Y-m-d', strtotime('-7 days'));
foreach ($sentLog as $key => $ts) {
    if (substr($key, 0, 10) >= $cutoff) {
        $cleanLog[$key] = $ts;
    }
}
$sentLog = $cleanLog;

$templates = $templateRepo->getAll();
$sentCount = 0;

foreach ($templates as $t) {
    $id = $t['id'];
    $isEnabled = intval($t['is_enabled'] ?? 1);
    $schedType = $t['schedule_type'] ?? 'instant';
    $schedDay = $t['schedule_day'] ?? '';
    $schedTime = $t['schedule_time'] ?? '';
    $recipients = trim($t['default_recipients'] ?? 'info@k-d-o.biz');
    $subjectTpl = $t['email_subject'] ?? '';
    $bodyTpl = $t['email_html_body'] ?? '';

    if (empty($recipients) || empty($subjectTpl) || empty($bodyTpl)) {
        continue;
    }

    $shouldSend = false;

    if ($forceTemplateId !== null) {
        if ($forceTemplateId === $id) {
            echo "-> Force triggering template: {$id}\n";
            $shouldSend = true;
        }
    } else {
        if ($isEnabled !== 1) {
            continue;
        }

        if ($schedType === 'instant') {
            // instantはイベント発生時に別経路で送るためCronではスキップ
            continue;
        }

        // スケジュール時刻の解析 (HH:mm)
        $schedHour = -1;
        $schedMin = -1;
        if (!empty($schedTime) && strpos($schedTime, ':') !== false) {
            list($sh, $sm) = explode(':', $schedTime);
            $schedHour = intval($sh);
            $schedMin = intval($sm);
        }

        // 送信判定
        $logKey = "{$todayDateStr}_{$id}";
        $alreadySentToday = isset($sentLog[$logKey]);

        if (!$alreadySentToday) {
            if ($schedType === 'weekly') {
                // 曜日と時刻の判定 (Cron実行間隔を考慮して該当時間帯以降に送信)
                if (strtolower($schedDay) === strtolower($currentDay)) {
                    if ($currentHour > $schedHour || ($currentHour === $schedHour && $currentMinute >= $schedMin)) {
                        $shouldSend = true;
                    }
                }
            } elseif ($schedType === 'daily') {
                if ($currentHour > $schedHour || ($currentHour === $schedHour && $currentMinute >= $schedMin)) {
                    $shouldSend = true;
                }
            }
        }
    }

    if ($shouldSend) {
        echo "-> Sending scheduled report: {$t['title']} ({$id}) to {$recipients}...\n";

        $context = $contextService->buildContext();
        $finalSubject = $contextService->replacePlaceholders($subjectTpl, $context);
        $finalBody = $contextService->replacePlaceholders($bodyTpl, $context);

        // 複数宛先の分割送信
        $recipientList = array_map('trim', explode(',', $recipients));
        $allSuccess = true;

        foreach ($recipientList as $toEmail) {
            if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) continue;

            $res = $mailService->sendHtmlEmail($toEmail, $finalSubject, $finalBody);
            if ($res['success']) {
                echo "   [SUCCESS] Sent to {$toEmail}\n";
            } else {
                echo "   [FAILED] Failed to send to {$toEmail}: {$res['message']}\n";
                $allSuccess = false;
            }
        }

        if ($forceTemplateId === null) {
            $sentLog["{$todayDateStr}_{$id}"] = date('Y-m-d H:i:s');
        }
        $sentCount++;
    }
}

// ログ保存
@file_put_contents($logFile, json_encode($sentLog, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "[" . date('Y-m-d H:i:s') . "] Finished. Sent: {$sentCount} report(s).\n";
