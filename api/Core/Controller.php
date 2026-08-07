<?php
namespace Api\Core;

/**
 * Abstract Base Controller
 */
abstract class Controller {
    protected array $input;

    public function __construct() {
        $raw = file_get_contents('php://input');
        $json = $raw ? json_decode($raw, true) : null;
        $this->input = is_array($json) ? $json : array_merge($_GET, $_POST);
    }

    protected function getParam(string $key, mixed $default = null): mixed {
        return $this->input[$key] ?? $_GET[$key] ?? $_POST[$key] ?? $default;
    }

    protected function getAction(): string {
        return $this->getParam('action', 'list');
    }
}
