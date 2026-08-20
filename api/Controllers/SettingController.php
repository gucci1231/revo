<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\SettingRepository;

class SettingController extends Controller {
    private SettingRepository $settingRepo;

    public function __construct(?SettingRepository $settingRepo = null) {
        parent::__construct();
        $this->settingRepo = $settingRepo ?? new SettingRepository();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'get':
                $this->get();
                break;
            case 'update':
                $this->update();
                break;
            case 'get_goals':
                $this->getGoals();
                break;
            case 'save_default_goals':
                $this->saveDefaultGoals();
                break;
            case 'save_monthly_goal':
                $this->saveMonthlyGoal();
                break;
            case 'delete_monthly_goal':
                $this->deleteMonthlyGoal();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function get(): void {
        $settings = $this->settingRepo->getAll();
        Response::success(['settings' => $settings]);
    }

    private function update(): void {
        $key = $this->getParam('key', '');
        $val = $this->getParam('value', '');

        if (!$key) {
            Response::error('Key is required');
        }

        if ($key === 'startDate') {
            $key = 'start_date';
        }

        $now = date('Y/m/d H:i');
        $this->settingRepo->setKey($key, $val, $now);

        Response::success([
            'key' => $key,
            'value' => $val
        ]);
    }

    private function getGoals(): void {
        $defaultGoals = $this->settingRepo->getDefaultGoals();
        $monthlyMap = $this->settingRepo->getMonthlyGoalsMap();

        // 過去〜未来6ヶ月程度の月リストを生成し、引き継ぎ解決後のプレビューデータを作成
        $currentYm = date('Y/m');
        $monthsPreview = [];
        $ts = strtotime(date('Y-m-01') . ' -2 months');
        for ($i = 0; $i < 12; $i++) {
            $ym = date('Y/m', $ts);
            $resolved = $this->settingRepo->resolveGoalsForMonth($ym);
            $monthsPreview[] = $resolved;
            $ts = strtotime('+1 month', $ts);
        }

        $settings = $this->settingRepo->getAll();
        $startDateStr = $settings['start_date'] ?? '2026/04/01';
        $bniTermsList = [
            ['label' => '第2期 (2026/04/01〜)', 'value' => '2026/04/01', 'dateStr' => '2026/04/01'],
            ['label' => '第1期 (2025/10/01〜)', 'value' => '2025/10/01', 'dateStr' => '2025/10/01'],
            ['label' => '全期間 (2024/10/01〜)', 'value' => '2024/10/01', 'dateStr' => '2024/10/01']
        ];

        Response::success([
            'defaultGoals' => $defaultGoals,
            'monthlyMap' => $monthlyMap,
            'monthsPreview' => $monthsPreview,
            'currentMonth' => $currentYm,
            'startDateStr' => $startDateStr,
            'bniTermsList' => $bniTermsList
        ]);
    }

    private function saveDefaultGoals(): void {
        $goals = $this->getParam('goals', []);
        if (!is_array($goals)) {
            Response::error('Goals must be an array');
        }

        $now = date('Y/m/d H:i');
        $this->settingRepo->setDefaultGoals($goals, $now);

        Response::success([
            'defaultGoals' => $this->settingRepo->getDefaultGoals()
        ]);
    }

    private function saveMonthlyGoal(): void {
        $month = $this->getParam('month', '');
        $goals = $this->getParam('goals', []);

        if (!$month) {
            Response::error('Month is required');
        }
        if (!is_array($goals)) {
            Response::error('Goals must be an array');
        }

        $now = date('Y/m/d H:i');
        $this->settingRepo->setMonthlyGoal($month, $goals, $now);

        $resolved = $this->settingRepo->resolveGoalsForMonth($month);
        Response::success([
            'month' => $month,
            'goals' => $resolved,
            'monthlyMap' => $this->settingRepo->getMonthlyGoalsMap()
        ]);
    }

    private function deleteMonthlyGoal(): void {
        $month = $this->getParam('month', '');
        if (!$month) {
            Response::error('Month is required');
        }

        $now = date('Y/m/d H:i');
        $this->settingRepo->setMonthlyGoal($month, null, $now);

        $resolved = $this->settingRepo->resolveGoalsForMonth($month);
        Response::success([
            'month' => $month,
            'goals' => $resolved,
            'monthlyMap' => $this->settingRepo->getMonthlyGoalsMap()
        ]);
    }
}
