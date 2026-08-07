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

        $now = date('Y/m/d H:i');
        $this->settingRepo->setKey($key, $val, $now);

        Response::success([
            'key' => $key,
            'value' => $val
        ]);
    }
}
