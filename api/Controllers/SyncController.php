<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Services\SyncService;

class SyncController extends Controller {
    private SyncService $syncService;

    public function __construct(?SyncService $syncService = null) {
        parent::__construct();
        $this->syncService = $syncService ?? new SyncService();
    }

    public function handle(): void {
        $result = $this->syncService->processSync($this->input);
        Response::json($result);
    }
}
