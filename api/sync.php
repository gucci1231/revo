<?php
require_once __DIR__ . '/bootstrap.php';
(new \Api\Controllers\SyncController())->handle();
