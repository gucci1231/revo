<?php
namespace Api\Services;

use Api\Core\Database;
use Exception;
use PDO;

/**
 * Service to interact with BNI Connect Global:
 * - Authentication via REST API
 * - Web session establishment (Spring Security JWT)
 * - Fetching chapter PALMS summary report
 * - Parsing tabular PALMS records
 * - Persisting PALMS records into SQLite
 */
class BniConnectService {
    private string $username;
    private string $password;
    private string $chapterId;
    private Database $db;

    public function __construct(?Database $db = null, ?string $username = null, ?string $password = null, ?string $chapterId = null) {
        $this->db = $db ?? Database::getInstance();
        $this->username = $username ?? getenv('BNI_USERNAME') ?: 'gucci1231@me.com';
        $this->password = $password ?? getenv('BNI_PASSWORD') ?: 'docvk!3Ka.';
        $this->chapterId = $chapterId ?? getenv('BNI_CHAPTER_ID') ?: '42376';
    }

    /**
     * Authenticate with BNI Connect API and return tokens
     */
    public function authenticate(): array {
        $url = 'https://api.bniconnectglobal.com/auth-api/authenticate';
        $payload = json_encode([
            'client_id' => 'IDENTITY_PORTAL',
            'user_id' => $this->username,
            'password' => $this->password
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Basic SURFTlRJVFlfUE9SVEFMOkdjVlN2JE1vODk1d0I2XjRTNA==',
            'Concept: CONNECT',
            'suppress-translations: y',
            'authorization-version: V2'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            throw new Exception("BNI Auth Network Error: " . $err);
        }
        if ($httpCode !== 200) {
            throw new Exception("BNI Auth Failed with HTTP {$httpCode}: " . substr($res, 0, 300));
        }

        $json = json_decode($res, true);
        if (!isset($json['content']['access_token'])) {
            throw new Exception("BNI Auth Response missing access_token: " . substr($res, 0, 300));
        }

        return $json['content'];
    }

    /**
     * Establish web session using Spring Security JWT check and return JSESSIONID cookie
     */
    public function establishWebSession(array $tokens): string {
        $url = 'https://www.bniconnectglobal.com/web/j_spring_security_jwt_check';
        $postData = http_build_query([
            'j_refresh' => $tokens['refresh_token'],
            'j_access' => $tokens['access_token'],
            'j_expiry' => $tokens['expires_in'],
            'j_username' => $this->username,
            'j_password' => $this->password,
            'j_login_page' => 'https://www.bniconnectglobal.com/login/'
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded',
            'Cookie: AUTH_INIT=Connect; Max-Age=28800; path=/web; Secure',
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $res = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headerStr = substr($res, 0, $headerSize);
        curl_close($ch);

        preg_match_all('/^Set-Cookie:\s*([^;]+)/mi', $headerStr, $matches);
        $jsessionId = null;
        if (!empty($matches[1])) {
            foreach ($matches[1] as $c) {
                if (stripos($c, 'JSESSIONID=') === 0) {
                    $jsessionId = $c;
                    break;
                }
            }
        }

        if (!$jsessionId) {
            throw new Exception("Failed to obtain JSESSIONID cookie from Spring Security check.");
        }

        return $jsessionId;
    }

    /**
     * Fetch PALMS report HTML for the given date range (MM/DD/YYYY)
     */
    public function fetchPalmsReportHtml(string $jsessionCookie, string $startDate, string $endDate): string {
        // Step 1: Request chapter PALMS report container
        $containerUrl = "https://www.bniconnectglobal.com/web/secure/reportsChapterPALMS?IdOrg=" . urlencode($this->chapterId)
            . "&startDate=" . urlencode($startDate)
            . "&endDate=" . urlencode($endDate)
            . "&ShowDetails=false&__exports_details=1";

        $ch = curl_init($containerUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Cookie: {$jsessionCookie}; AUTH_INIT=Connect",
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $containerHtml = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($containerHtml)) {
            throw new Exception("Failed to fetch reportsChapterPALMS container. HTTP: {$httpCode}");
        }

        // Step 2: Extract iframe src
        if (!preg_match('/src="([^"]*secureWebReport[^"]*)"/i', $containerHtml, $m)) {
            throw new Exception("IFrame for secureWebReport not found in container response.");
        }

        $iframeSrc = str_replace('&amp;', '&', $m[1]);
        $tableUrl = 'https://www.bniconnectglobal.com' . $iframeSrc;

        // Step 3: Fetch actual report table HTML
        $ch = curl_init($tableUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Cookie: {$jsessionCookie}; AUTH_INIT=Connect",
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $tableHtml = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || empty($tableHtml)) {
            throw new Exception("Failed to fetch report table. HTTP: {$httpCode}");
        }

        return $tableHtml;
    }

    /**
     * Parse HTML table and extract member PALMS metrics
     */
    public function parsePalmsHtml(string $html, string $startDate, string $endDate): array {
        // Convert MM/DD/YYYY to YYYY-MM-DD standard format
        $isoStartDate = $this->toIsoDate($startDate);
        $isoEndDate = $this->toIsoDate($endDate);

        $records = [];
        
        // Find all <tr> rows
        preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $html, $rowMatches);
        if (empty($rowMatches[1])) {
            return $records;
        }

        foreach ($rowMatches[1] as $rowHtml) {
            // Must contain member view link
            if (!preg_match('/operationsRegionMembershipViewMember\?memberId=(\d+)[^>]*>([^<]+)<\/a>/i', $rowHtml, $memberMatch)) {
                continue;
            }

            $memberId = trim($memberMatch[1]);
            $memberName = trim($memberMatch[2]);

            // Skip placeholder names like "ビジター" or "BNI"
            if (in_array($memberName, ['ビジター', 'BNI', '合計'])) {
                continue;
            }

            // Extract all <td> cells
            preg_match_all('/<td[^>]*>(.*?)<\/td>/is', $rowHtml, $tdMatches);
            if (empty($tdMatches[1]) || count($tdMatches[1]) < 15) {
                continue;
            }

            $cells = [];
            foreach ($tdMatches[1] as $td) {
                // Strip tags and whitespace
                $val = trim(strip_tags($td));
                $cells[] = $val;
            }

            // Cell mapping based on PALMS table layout:
            // index 0: Member Name (colspan=2 in some HTML, or first td)
            // Following indices are numeric values:
            // 出 (P), 欠 (A), 遅 (L), 医 (M), 代 (S), 内与 (RGI), 外与 (RGO), 内受 (RRI), 外受 (RRO), ビ (V), 1to1, 千円 (TYFCB), CEU, 推薦のことば
            $numValues = [];
            for ($i = 1; $i < count($cells); $i++) {
                if (is_numeric($cells[$i])) {
                    $numValues[] = (float)$cells[$i];
                }
            }

            if (count($numValues) < 14) {
                continue;
            }

            $p = (int)$numValues[0];
            $a = (int)$numValues[1];
            $l = (int)$numValues[2];
            $m = (int)$numValues[3];
            $s = (int)$numValues[4];
            $rgi = (int)$numValues[5];
            $rgo = (int)$numValues[6];
            $rri = (int)$numValues[7];
            $rro = (int)$numValues[8];
            $v = (int)$numValues[9];
            $oneToOne = (int)$numValues[10];
            $tyfcbKyen = (float)$numValues[11]; // In thousands of yen (e.g. 1130.00 = 1,130,000 yen)
            $ceu = (int)$numValues[12];
            $testimonials = (int)$numValues[13];

            $recordId = hash('sha256', "{$memberId}_{$isoStartDate}_{$isoEndDate}");

            $records[] = [
                'id' => $recordId,
                'member_id' => $memberId,
                'member_name' => $memberName,
                'start_date' => $isoStartDate,
                'end_date' => $isoEndDate,
                'p_present' => $p,
                'a_absent' => $a,
                'l_late' => $l,
                'm_medical' => $m,
                's_substitute' => $s,
                'rgi_referrals_given_internal' => $rgi,
                'rgo_referrals_given_external' => $rgo,
                'rri_referrals_received_internal' => $rri,
                'rro_referrals_received_external' => $rro,
                'v_visitors' => $v,
                'one_to_ones' => $oneToOne,
                'tyfcb_amount' => $tyfcbKyen,
                'ceu' => $ceu,
                'testimonials' => $testimonials
            ];
        }

        return $records;
    }

    /**
     * Save PALMS records into SQLite
     */
    public function savePalmsToDb(array $records): int {
        if (empty($records)) {
            return 0;
        }

        $pdo = $this->db->getPdo();
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("
            INSERT OR REPLACE INTO palms_reports (
                id, member_id, member_name, start_date, end_date,
                p_present, a_absent, l_late, m_medical, s_substitute,
                rgi_referrals_given_internal, rgo_referrals_given_external,
                rri_referrals_received_internal, rro_referrals_received_external,
                v_visitors, one_to_ones, tyfcb_amount, ceu, testimonials,
                created_at, updated_at
            ) VALUES (
                :id, :member_id, :member_name, :start_date, :end_date,
                :p_present, :a_absent, :l_late, :m_medical, :s_substitute,
                :rgi_referrals_given_internal, :rgo_referrals_given_external,
                :rri_referrals_received_internal, :rro_referrals_received_external,
                :v_visitors, :one_to_ones, :tyfcb_amount, :ceu, :testimonials,
                COALESCE((SELECT created_at FROM palms_reports WHERE id = :id), :created_at),
                :updated_at
            )
        ");

        $memberStmt = $pdo->prepare("
            INSERT OR IGNORE INTO members (id, category, name, profession, updated_at)
            VALUES (:id, 'その他', :name, '', :updated_at)
        ");

        $pdo->beginTransaction();
        try {
            $count = 0;
            foreach ($records as $r) {
                $stmt->execute([
                    ':id' => $r['id'],
                    ':member_id' => $r['member_id'],
                    ':member_name' => $r['member_name'],
                    ':start_date' => $r['start_date'],
                    ':end_date' => $r['end_date'],
                    ':p_present' => $r['p_present'],
                    ':a_absent' => $r['a_absent'],
                    ':l_late' => $r['l_late'],
                    ':m_medical' => $r['m_medical'],
                    ':s_substitute' => $r['s_substitute'],
                    ':rgi_referrals_given_internal' => $r['rgi_referrals_given_internal'],
                    ':rgo_referrals_given_external' => $r['rgo_referrals_given_external'],
                    ':rri_referrals_received_internal' => $r['rri_referrals_received_internal'],
                    ':rro_referrals_received_external' => $r['rro_referrals_received_external'],
                    ':v_visitors' => $r['v_visitors'],
                    ':one_to_ones' => $r['one_to_ones'],
                    ':tyfcb_amount' => $r['tyfcb_amount'],
                    ':ceu' => $r['ceu'],
                    ':testimonials' => $r['testimonials'],
                    ':created_at' => $now,
                    ':updated_at' => $now
                ]);

                // Ensure member exists in members table
                $memberStmt->execute([
                    ':id' => $r['member_id'],
                    ':name' => $r['member_name'],
                    ':updated_at' => $now
                ]);

                $count++;
            }
            $pdo->commit();
            return $count;
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Execute full sync pipeline for a specific date range
     */
    public function sync(string $startDate, string $endDate): array {
        $tokens = $this->authenticate();
        $cookie = $this->establishWebSession($tokens);
        $html = $this->fetchPalmsReportHtml($cookie, $startDate, $endDate);
        $records = $this->parsePalmsHtml($html, $startDate, $endDate);
        $savedCount = $this->savePalmsToDb($records);

        return [
            'success' => true,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'recordsCount' => count($records),
            'savedCount' => $savedCount,
            'records' => $records
        ];
    }

    /**
     * Sync multiple recent weeks of PALMS data (e.g. 4 to 8 weeks)
     */
    public function syncRecentWeeks(int $weeksCount = 4): array {
        $tokens = $this->authenticate();
        $cookie = $this->establishWebSession($tokens);

        $results = [];
        $totalSaved = 0;

        $today = new \DateTime();
        $dayOfWeek = (int)$today->format('w');
        $baseThu = clone $today;
        if ($dayOfWeek >= 4) {
            $baseThu->modify('-' . ($dayOfWeek - 4) . ' days');
        } else {
            $baseThu->modify('-' . ($dayOfWeek + 3) . ' days');
        }

        for ($i = 0; $i < $weeksCount; $i++) {
            $endThu = clone $baseThu;
            if ($i > 0) {
                $endThu->modify('-' . ($i * 7) . ' days');
            }
            $startThu = clone $endThu;
            $startThu->modify('-7 days');

            $s = $startThu->format('m/d/Y');
            $e = $endThu->format('m/d/Y');

            $html = $this->fetchPalmsReportHtml($cookie, $s, $e);
            $records = $this->parsePalmsHtml($html, $s, $e);
            $saved = $this->savePalmsToDb($records);
            $totalSaved += $saved;

            $results[] = [
                'startDate' => $s,
                'endDate' => $e,
                'recordsCount' => count($records),
                'savedCount' => $saved
            ];
        }

        return [
            'success' => true,
            'totalSaved' => $totalSaved,
            'weeks' => $results
        ];
    }

    /**
     * Compute last week's date range (last Thursday to this Thursday) in MM/DD/YYYY format
     */
    public static function getDefaultWeeklyRange(): array {
        $today = new \DateTime();
        // 4 = Thursday
        $dayOfWeek = (int)$today->format('w');
        
        $thisThu = clone $today;
        if ($dayOfWeek >= 4) {
            $thisThu->modify('-' . ($dayOfWeek - 4) . ' days');
        } else {
            $thisThu->modify('-' . ($dayOfWeek + 3) . ' days');
        }

        $lastThu = clone $thisThu;
        $lastThu->modify('-7 days');

        return [
            'startDate' => $lastThu->format('m/d/Y'),
            'endDate' => $thisThu->format('m/d/Y')
        ];
    }

    private function toIsoDate(string $dateStr): string {
        $parts = explode('/', $dateStr);
        if (count($parts) === 3) {
            // MM/DD/YYYY
            return sprintf('%04d-%02d-%02d', (int)$parts[2], (int)$parts[0], (int)$parts[1]);
        }
        return $dateStr;
    }
}
