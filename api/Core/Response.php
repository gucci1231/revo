<?php
namespace Api\Core;

/**
 * Standardized Response Helper
 */
class Response {
    public static function json(array $data, int $statusCode = 200): void {
        if (ob_get_length()) {
            ob_clean();
        }
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    public static function success(array $extraData = []): void {
        self::json(array_merge(['success' => true], $extraData));
    }

    public static function error(string $message, int $statusCode = 400): void {
        self::json(['success' => false, 'message' => $message], $statusCode);
    }

    public static function redirect(string $url): void {
        header('Location: ' . $url);
        exit;
    }
}
