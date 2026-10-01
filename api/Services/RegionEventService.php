<?php
namespace Api\Services;

use Api\Core\Database;
use Exception;

class RegionEventService {
    private Database $db;
    private const REGION_ID = '7641'; // BNI 京都シティセントラル
    private const BASE_URL = 'https://bni-ck.com';

    public function __construct(?Database $db = null) {
        $this->db = $db ?? Database::getInstance();
    }

    /**
     * Fetch all event types from BNI CK
     */
    public function fetchEventTypes(): array {
        $url = self::BASE_URL . "/web/open/cmsViewEventTypesJson?regionIds=" . self::REGION_ID . "&request_locale=ja&siteLocale=ja";
        $json = $this->httpGet($url);
        if (!$json) {
            return [];
        }
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return [];
        }
        $typesMap = [];
        foreach ($data as $item) {
            if (isset($item['typeID'], $item['typeName'])) {
                $typesMap[(int)$item['typeID']] = (string)$item['typeName'];
            }
        }
        return $typesMap;
    }

    /**
     * Fetch calendar events from BNI CK within given timestamp range
     */
    public function fetchCalendarEvents(int $startTimestamp, int $endTimestamp, int $eventTypeId = 0): array {
        $url = self::BASE_URL . "/web/open/cmsViewEventsCalendarJson?regionIds=" . self::REGION_ID . "&eventTypeId=" . $eventTypeId . "&cmsv3=true&start=" . $startTimestamp . "&end=" . $endTimestamp;
        $json = $this->httpGet($url);
        if (!$json) {
            return [];
        }
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Fetch detailed event page info via BNI CK internal AJAX endpoint
     */
    public function fetchEventDetail(string $eventIdHash): array {
        $url = self::BASE_URL . "/bnicms/v3/frontend/eventdetail/display";
        $decodedEventId = urldecode($eventIdHash);

        $mappedWidgetSettings = json_encode([
            ["key" => 178, "name" => "Contact Person", "value" => "担当者"],
            ["key" => 179, "name" => "Cost for members:", "value" => "価格（BNIメンバー）:"],
            ["key" => 180, "name" => "Cost for non-members:", "value" => "価格（BNIメンバー以外）:"],
            ["key" => 181, "name" => "Max No of attendees:", "value" => "定員:"],
            ["key" => 182, "name" => "No of registrations:", "value" => "登録数:"],
            ["key" => 183, "name" => "Registration for members", "value" => "参加申込（BNIメンバー）"],
            ["key" => 184, "name" => "Registration for non-members", "value" => "参加申込（BNIメンバー以外）"],
            ["key" => 185, "name" => "to", "value" => "～"],
            ["key" => 186, "name" => "Location/Area", "value" => "開催地"],
            ["key" => 351, "name" => "Back", "value" => "戻る"]
        ], JSON_UNESCAPED_UNICODE);

        $postFields = [
            'pageMode' => 'Live_Site',
            'languages[activeLanguage][id]' => '13',
            'languages[activeLanguage][localeCode]' => 'ja',
            'languages[activeLanguage][descriptionKey]' => 'Japanese',
            'mappedWidgetSettings' => $mappedWidgetSettings,
            'eventId' => $decodedEventId
        ];

        $html = $this->httpPost($url, $postFields);
        if (!$html) {
            return [];
        }

        return $this->parseDetailHtml($html);
    }

    /**
     * Parse HTML response from event detail AJAX call
     */
    public function parseDetailHtml(string $html): array {
        $detail = [
            'location_name' => '',
            'location_address' => '',
            'location_map_url' => '',
            'is_online' => 0,
            'cost_member' => '',
            'cost_non_member' => '',
            'contact_name' => '',
            'contact_phone' => '',
            'max_attendees' => 0,
            'num_registered' => 0,
            'registration_url' => '',
            'body_html' => ''
        ];

        // 1. Check if online
        if (preg_match('/(オンライン|online|ZOOM|Zoom|zoom)/iu', $html)) {
            $detail['is_online'] = 1;
        }

        // 2. Body description (in holder threeColRow first column)
        if (preg_match('/<div class="col-xs-12 col-sm-12 col-md-4">(.*?)<\/div>\s*<div class="col-xs-12 col-sm-6 col-md-4">/is', $html, $m)) {
            $detail['body_html'] = trim($m[1]);
        }

        // 3. Contact person & Phone
        if (preg_match('/<h3>担当者<\/h3>.*?<div class="rCol">\s*<p>(.*?)<\/p>/is', $html, $m)) {
            $contactRaw = trim(strip_tags($m[1], '<br>'));
            $lines = array_filter(array_map('trim', explode('<br>', str_replace(['<br/>', '<br />'], '<br>', $contactRaw))));
            if (!empty($lines)) {
                $detail['contact_name'] = array_shift($lines);
                foreach ($lines as $line) {
                    if (preg_match('/Phone\s*No:\s*([0-9\-]+)/i', $line, $pm)) {
                        $detail['contact_phone'] = $pm[1];
                    }
                }
            }
        }

        // 4. Cost for members
        if (preg_match('/価格（BNIメンバー）:<\/span>\s*([^<]+)/u', $html, $m)) {
            $detail['cost_member'] = trim($m[1]);
        }
        // Cost for non-members
        if (preg_match('/価格（BNIメンバー以外）:<\/span>\s*([^<]+)/u', $html, $m)) {
            $detail['cost_non_member'] = trim($m[1]);
        }

        // 5. Max attendees
        if (preg_match('/定員:<\/span>\s*(\d+)/u', $html, $m)) {
            $detail['max_attendees'] = (int)$m[1];
        }

        // 6. Registrations
        if (preg_match('/登録数:<\/span>\s*(\d+)/u', $html, $m)) {
            $detail['num_registered'] = (int)$m[1];
        }

        // 7. Location & Address
        if (preg_match('/<div class="box"><h3>開催地<\/h3>\s*<p class="address">(.*?)<\/p>/is', $html, $m)) {
            $addrRaw = trim($m[1]);
            // Extract map url if present
            if (preg_match('/<a href=[\'"](https:\/\/[^\'"]+)[\'"][^>]*vieweventlocation/i', $addrRaw, $mapM)) {
                $detail['location_map_url'] = $mapM[1];
            }
            $cleanAddr = trim(strip_tags($addrRaw));
            $addrLines = array_filter(array_map('trim', explode("\n", str_replace(["\r", "<br>", "<br/>", "<br />"], "\n", $cleanAddr))));
            if (!empty($addrLines)) {
                $detail['location_name'] = array_shift($addrLines);
                $detail['location_address'] = implode(' ', $addrLines);
            }
        }

        // 8. Direct registration URL (BNI Connect Global)
        if (preg_match('/<a href=[\'"](https:\/\/www\.bniconnectglobal\.com\/web\/secure\/appsEventsViewEventDetails\?eventId=\d+)[\'"]/i', $html, $m)) {
            $detail['registration_url'] = $m[1];
        }

        return $detail;
    }

    /**
     * Run full synchronization
     */
    public function sync(int $daysBack = 30, int $monthsAhead = 6, bool $fetchDetails = true, ?callable $progressCallback = null): array {
        $now = time();
        $startTs = $now - ($daysBack * 86400);
        $endTs = strtotime("+{$monthsAhead} months", $now);

        // 1. Fetch Types
        $typesMap = $this->fetchEventTypes();

        // 2. Fetch Events
        $rawEvents = $this->fetchCalendarEvents($startTs, $endTs, 0);
        $totalFetched = count($rawEvents);
        $savedCount = 0;
        $updatedCount = 0;

        $currentTimeStr = date('Y/m/d H:i');

        foreach ($rawEvents as $idx => $ev) {
            $eventId = (int)($ev['id'] ?? 0);
            if (!$eventId) continue;

            $title = trim((string)($ev['title'] ?? ''));
            $desc = trim((string)($ev['description'] ?? ''));
            $start = str_replace('T', ' ', (string)($ev['start'] ?? '')) . ':00';
            $end = str_replace('T', ' ', (string)($ev['end'] ?? '')) . ':00';
            $rawUrl = (string)($ev['url'] ?? '');

            // Extract hash from url (e.g. eventdetails?eventId=...)
            $eventIdHash = '';
            if (preg_match('/eventId=([^&]+)/', $rawUrl, $um)) {
                $eventIdHash = $um[1];
            }

            // Determine event type name if matched or heuristic
            $eventTypeName = '';
            $eventTypeId = 0;
            foreach ($typesMap as $tid => $tname) {
                if (mb_stripos($title, $tname) !== false) {
                    $eventTypeName = $tname;
                    $eventTypeId = $tid;
                    break;
                }
            }

            // Check existing
            $existing = $this->db->fetchOne("SELECT * FROM region_events WHERE id = ?", [$eventId]);

            $record = [
                'id' => $eventId,
                'event_id_hash' => $eventIdHash,
                'title' => $title,
                'description' => $desc,
                'event_type_id' => $eventTypeId,
                'event_type_name' => $eventTypeName,
                'start_datetime' => $start,
                'end_datetime' => $end,
                'detail_url' => self::BASE_URL . '/ja/' . $rawUrl,
                'updated_at' => $currentTimeStr
            ];

            // If online in title
            if (preg_match('/(オンライン|online|ZOOM|Zoom|zoom)/iu', $title)) {
                $record['is_online'] = 1;
            }

            // Fetch details if needed (for upcoming events or if details not yet fetched)
            if ($fetchDetails && $eventIdHash && (!$existing || empty($existing['body_html']) || strtotime($start) >= $now - 86400)) {
                try {
                    $details = $this->fetchEventDetail($eventIdHash);
                    if (!empty($details)) {
                        $record = array_merge($record, $details);
                    }
                    usleep(150000); // 150ms throttle to be gentle on server
                } catch (Exception $e) {
                    // Ignore detail fetch failure and proceed
                }
            }

            if ($existing) {
                $this->db->update('region_events', $record, 'id = ?', [$eventId]);
                $updatedCount++;
            } else {
                $record['created_at'] = $currentTimeStr;
                $this->db->insert('region_events', $record);
                $savedCount++;
            }

            if ($progressCallback) {
                $progressCallback($idx + 1, $totalFetched, $title);
            }
        }

        // Save last sync time to settings table
        $this->saveSetting('last_events_synced_at', $currentTimeStr);

        return [
            'totalFetched' => $totalFetched,
            'savedCount' => $savedCount,
            'updatedCount' => $updatedCount,
            'lastSyncedAt' => $currentTimeStr
        ];
    }

    private function saveSetting(string $key, string $value): void {
        $exists = $this->db->fetchColumn("SELECT COUNT(*) FROM settings WHERE `key` = ?", [$key]);
        if ($exists) {
            $this->db->update('settings', ['value' => $value], '`key` = ?', [$key]);
        } else {
            $this->db->insert('settings', ['key' => $key, 'value' => $value]);
        }
    }

    private function httpGet(string $url): ?string {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code >= 200 && $code < 300) ? (string)$response : null;
    }

    private function httpPost(string $url, array $postData): ?string {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postData),
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code >= 200 && $code < 300) ? (string)$response : null;
    }
}
