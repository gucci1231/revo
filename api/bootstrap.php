<?php
/**
 * Application Bootstrap & PSR-4 Autoloader
 */
spl_autoload_register(function ($class) {
    $prefix = 'Api\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

// Helper for backward compatibility
if (!function_exists('sendJsonResponse')) {
    function sendJsonResponse($data) {
        \Api\Core\Response::json($data);
    }
}
