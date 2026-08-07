<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Services\DashboardService;

class DashboardController extends Controller {
    private DashboardService $dashboardService;

    public function __construct(?DashboardService $dashboardService = null) {
        parent::__construct();
        $this->dashboardService = $dashboardService ?? new DashboardService();
    }

    public function handle(): void {
        $startDateStr = $this->getParam('start_date', '');
        $data = $this->dashboardService->getDashboardData($startDateStr);
        Response::json($data);
    }
}
