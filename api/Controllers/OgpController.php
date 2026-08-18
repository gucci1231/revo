<?php
namespace Api\Controllers;

use Api\Core\Response;
use Api\Core\Database;
use PDO;

/**
 * Controller for Fetching & Caching Open Graph Protocol (OGP) Metadata
 */
class OgpController {
    private ?PDO $db;

    public function __construct() {
        try {
            $this->db = Database::getInstance()->getPdo();
            $this->initTable();
        } catch (\Throwable $e) {
            $this->db = null;
        }
    }

    private function initTable(): void {
        if (!$this->db) return;
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS ogp_cache (
                url TEXT PRIMARY KEY,
                domain TEXT,
                title TEXT,
                description TEXT,
                image TEXT,
                site_name TEXT,
                favicon TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    }

    public function handle(): void {
        $url = trim($_GET['url'] ?? '');
        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            Response::error('Invalid or missing URL parameter', 400);
            return;
        }

        $parsed = parse_url($url);
        $scheme = strtolower($parsed['scheme'] ?? '');
        if (!in_array($scheme, ['http', 'https'], true)) {
            Response::error('Only HTTP and HTTPS URLs are supported', 400);
            return;
        }

        $host = $parsed['host'] ?? '';
        if (!$host || $this->isPrivateHost($host)) {
            Response::error('Disallowed host address', 403);
            return;
        }

        // 1. Check SQLite Cache (Valid for 7 days)
        $cached = $this->getCached($url);
        if ($cached) {
            Response::success(['data' => $cached, 'cached' => true]);
            return;
        }

        // 2. Fetch OGP from Web
        $ogp = $this->fetchOgp($url);
        if ($ogp) {
            $this->saveCache($url, $ogp);
            Response::success(['data' => $ogp, 'cached' => false]);
            return;
        }

        Response::error('Failed to retrieve OGP metadata', 404);
    }

    private function isPrivateHost(string $host): bool {
        if (in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return true;
        }
        return false;
    }

    private function getCached(string $url): ?array {
        if (!$this->db) return null;
        try {
            $stmt = $this->db->prepare("
                SELECT domain, title, description, image, site_name, favicon
                FROM ogp_cache
                WHERE url = :url AND created_at > datetime('now', '-7 days')
                LIMIT 1
            ");
            $stmt->execute([':url' => $url]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $row['url'] = $url;
                return $row;
            }
        } catch (\Throwable $e) {}
        return null;
    }

    private function saveCache(string $url, array $data): void {
        if (!$this->db) return;
        try {
            $stmt = $this->db->prepare("
                INSERT OR REPLACE INTO ogp_cache (url, domain, title, description, image, site_name, favicon, created_at)
                VALUES (:url, :domain, :title, :description, :image, :site_name, :favicon, datetime('now'))
            ");
            $stmt->execute([
                ':url' => $url,
                ':domain' => $data['domain'] ?? '',
                ':title' => $data['title'] ?? '',
                ':description' => $data['description'] ?? '',
                ':image' => $data['image'] ?? '',
                ':site_name' => $data['site_name'] ?? '',
                ':favicon' => $data['favicon'] ?? ''
            ]);
        } catch (\Throwable $e) {}
    }

    private function fetchOgp(string $url): ?array {
        $parsed = parse_url($url);
        $domain = $parsed['host'] ?? '';
        $defaultFavicon = "https://www.google.com/s2/favicons?domain=" . urlencode($domain) . "&sz=64";

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) Twitterbot/1.0',
            CURLOPT_HTTPHEADER => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language: ja,en-US;q=0.9,en;q=0.8'
            ]
        ]);

        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$html || $httpCode < 200 || $httpCode >= 400) {
            // 最低限のフォールバックデータ
            return [
                'url' => $url,
                'domain' => $domain,
                'title' => $domain,
                'description' => '',
                'image' => '',
                'site_name' => $domain,
                'favicon' => $defaultFavicon
            ];
        }

        // エンコーディングの自動検出・変換
        if (function_exists('mb_detect_encoding') && function_exists('mb_convert_encoding')) {
            $encoding = mb_detect_encoding($html, ['UTF-8', 'SJIS', 'EUC-JP', 'ASCII'], true);
            if ($encoding && $encoding !== 'UTF-8') {
                $html = mb_convert_encoding($html, 'UTF-8', $encoding);
            }
        }

        $title = '';
        $description = '';
        $image = '';
        $siteName = '';

        // OGPタグおよび標準metaタグのパース
        // 1. og:title
        if (preg_match('/<meta[^>]+property=[\'"]og:title[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"]og:title[\'"]/i', $html, $m)) {
            $title = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        } elseif (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $m)) {
            $title = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        // 2. og:description / meta description
        if (preg_match('/<meta[^>]+property=[\'"]og:description[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"]og:description[\'"]/i', $html, $m)) {
            $description = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        } elseif (preg_match('/<meta[^>]+name=[\'"]description[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
                  preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+name=[\'"]description[\'"]/i', $html, $m)) {
            $description = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        // 3. og:image / twitter:image / link image_src / 本文画像
        if (preg_match('/<meta[^>]+property=[\'"](?:og:image|og:image:url)[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"](?:og:image|og:image:url)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+name=[\'"](?:twitter:image|twitter:image:src)[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+name=[\'"](?:twitter:image|twitter:image:src)[\'"]/i', $html, $m) ||
            preg_match('/<link[^>]+rel=[\'"]image_src[\'"][^>]+href=[\'"]([^\'"]+)[\'"]/i', $html, $m)) {
            $image = trim($m[1]);
        } elseif (preg_match('/https:\/\/imgfp\.hotp\.jp\/IMGH\/[^\/]+\/[^\/]+\/P[0-9]+\/P[0-9]+_(?:480|238|300)\.jpg/i', $html, $m)) {
            $image = $m[0];
        } elseif (preg_match_all('/<img[^>]+src=[\'"]([^"\'>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"\'>]*)?)[\'"]/i', $html, $allImgs)) {
            foreach ($allImgs[1] as $candidate) {
                $candidate = trim($candidate);
                // ロゴ・トラッキング・アイコンを除外して写真らしきものを選択
                if (!preg_match('/(beacon|track|1x1|spacer|clear|pixel|logo|btn_|icn_|arrow|icon)/i', $candidate)) {
                    $image = $candidate;
                    break;
                }
            }
        }

        // 相対URLを絶対URLに解決
        if ($image && !preg_match('/^https?:\/\//i', $image)) {
            $base = $parsed['scheme'] . '://' . $parsed['host'] . ($parsed['port'] ? ':' . $parsed['port'] : '');
            $image = (str_starts_with($image, '/') ? $base : $base . '/') . ltrim($image, '/');
        }

        // 4. og:site_name
        if (preg_match('/<meta[^>]+property=[\'"]og:site_name[\'"][^>]+content=[\'"]([^\'"]+)[\'"]/i', $html, $m) ||
            preg_match('/<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"]og:site_name[\'"]/i', $html, $m)) {
            $siteName = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        // ドメイン固有のデフォルト対応 (Instagram / Hotpepperなど)
        if (str_contains($domain, 'instagram.com')) {
            $siteName = $siteName ?: 'Instagram';
            if (!$image) {
                $image = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png';
            }
            if ($title === 'Instagram' && preg_match('/instagram\.com\/([^\/?#]+)/i', $url, $im)) {
                $title = '@' . $im[1] . ' (Instagram)';
            }
        } elseif (str_contains($domain, 'hotpepper.jp')) {
            $siteName = $siteName ?: 'ホットペッパーグルメ';
        }

        if (!$title) {
            $title = $domain;
        }

        return [
            'url' => $url,
            'domain' => $domain,
            'title' => $title,
            'description' => $description,
            'image' => $image,
            'site_name' => $siteName ?: $domain,
            'favicon' => $defaultFavicon
        ];
    }
}
