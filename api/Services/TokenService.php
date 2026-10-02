<?php
namespace Api\Services;

/**
 * TokenService - Stateless HMAC-SHA256 Token Provider for Zero-Login & Safe Actions
 * 
 * Provides cryptographic tokens for email/LINE magic links and 1-tap actions.
 * Conforms strictly to REVO OS Specification Chapter 2.4 & 7.3.
 */
class TokenService {
    private static ?string $secretKey = null;

    /**
     * Get secret key from environment, config or persistent file
     */
    public static function getSecretKey(): string {
        if (self::$secretKey !== null) {
            return self::$secretKey;
        }

        // 1. Environment variable
        $envKey = getenv('REVO_AUTH_SECRET');
        if (!empty($envKey)) {
            self::$secretKey = $envKey;
            return self::$secretKey;
        }

        // 2. Persistent secret key file in data directory
        $keyFile = __DIR__ . '/../data/.secret_key';
        if (file_exists($keyFile)) {
            $key = trim(file_get_contents($keyFile));
            if (!empty($key)) {
                self::$secretKey = $key;
                return self::$secretKey;
            }
        }

        // 3. Fallback deterministic salt based on system seed
        $generated = hash('sha256', 'revo_visitor_host_revolution_2026_salt_' . php_uname());
        @file_put_contents($keyFile, $generated);
        self::$secretKey = $generated;
        return self::$secretKey;
    }

    /**
     * Set secret key manually (useful for testing)
     */
    public static function setSecretKey(?string $key): void {
        self::$secretKey = $key;
    }

    /**
     * Base64URL encode helper
     */
    public static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Base64URL decode helper
     */
    public static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
    }

    /**
     * Generate HMAC-SHA256 Stateless Token
     * 
     * @param array $payload Key-value data to embed (e.g. member_id, action, target_id, value)
     * @param int $ttlSeconds Time to live in seconds (default 30 days = 2,592,000s)
     * @return string
     */
    public static function generateToken(array $payload, int $ttlSeconds = 2592000): string {
        $now = time();
        $payload['iat'] = $now;
        if (!isset($payload['exp']) && $ttlSeconds > 0) {
            $payload['exp'] = $now + $ttlSeconds;
        }
        if (!isset($payload['rnd'])) {
            $payload['rnd'] = bin2hex(random_bytes(6));
        }

        $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $encodedPayload = self::base64UrlEncode($jsonPayload);

        $secret = self::getSecretKey();
        $rawSignature = hash_hmac('sha256', $encodedPayload, $secret, true);
        $encodedSignature = self::base64UrlEncode($rawSignature);

        return $encodedPayload . '.' . $encodedSignature;
    }

    /**
     * Verify HMAC-SHA256 Token and return decoded payload if valid and not expired
     * 
     * @param string $token
     * @return array|null Returns array payload or null if invalid/tampered/expired
     */
    public static function verifyToken(string $token): ?array {
        if (empty($token) || strpos($token, '.') === false) {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $providedSignature] = $parts;

        $secret = self::getSecretKey();
        $expectedRawSignature = hash_hmac('sha256', $encodedPayload, $secret, true);
        $expectedSignature = self::base64UrlEncode($expectedRawSignature);

        // Constant time comparison against timing attacks
        if (!hash_equals($expectedSignature, $providedSignature)) {
            return null;
        }

        $decodedJson = self::base64UrlDecode($encodedPayload);
        if (!$decodedJson) {
            return null;
        }

        $payload = json_decode($decodedJson, true);
        if (!is_array($payload)) {
            return null;
        }

        // Expiration check
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null; // Expired
        }

        return $payload;
    }

    /**
     * Helper to create Action URL (act.php)
     */
    public static function generateActionUrl(string $action, int $memberId, mixed $targetId = null, mixed $value = null, int $ttl = 604800, string $baseUrl = ''): string {
        $token = self::generateToken([
            'm' => $memberId,
            'a' => $action,
            't' => $targetId,
            'v' => $value
        ], $ttl);

        if (empty($baseUrl)) {
            $baseUrl = 'https://revo.k-d-o.biz';
        }
        return rtrim($baseUrl, '/') . '/act.php?k=' . urlencode($token);
    }

    /**
     * Helper to create Member My Portal URL (my.php)
     */
    public static function generatePortalUrl(int $memberId, int $ttl = 2592000, string $baseUrl = ''): string {
        $token = self::generateToken([
            'm' => $memberId,
            'a' => 'portal'
        ], $ttl);

        if (empty($baseUrl)) {
            $baseUrl = 'https://revo.k-d-o.biz';
        }
        return rtrim($baseUrl, '/') . '/my.php?k=' . urlencode($token);
    }
}
