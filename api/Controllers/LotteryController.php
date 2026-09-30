<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\LotteryRepository;

class LotteryController extends Controller {
    private LotteryRepository $lotteryRepo;

    public function __construct(?LotteryRepository $lotteryRepo = null) {
        parent::__construct();
        $this->lotteryRepo = $lotteryRepo ?? new LotteryRepository();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
                $this->list();
                break;
            case 'record':
                $this->record();
                break;
            case 'delete':
                $this->delete();
                break;
            case 'reset':
                $this->reset();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function list(): void {
        $members = $this->lotteryRepo->getMembersWithLotteryStats();
        $history = $this->lotteryRepo->getAllHistory();

        Response::success([
            'members' => $members,
            'history' => $history
        ]);
    }

    private function record(): void {
        $memberId = (string)$this->getParam('member_id', '');
        $memberName = (string)$this->getParam('member_name', '');
        $awardTitle = (string)$this->getParam('award_title', '定例会プレゼント');
        $wonAt = (string)$this->getParam('won_at', date('Y/m/d'));

        if (empty($memberId) || empty($memberName)) {
            Response::error('member_id and member_name are required');
            return;
        }

        $id = $this->lotteryRepo->recordWin($memberId, $memberName, $awardTitle, $wonAt);
        Response::success([
            'id' => $id,
            'message' => '当選を記録しました'
        ]);
    }

    private function delete(): void {
        $id = (string)$this->getParam('id', '');
        if (empty($id)) {
            Response::error('id is required');
            return;
        }

        $this->lotteryRepo->deleteHistory($id);
        Response::success(['message' => '履歴を削除しました']);
    }

    private function reset(): void {
        $this->lotteryRepo->resetHistory();
        Response::success(['message' => '全当選履歴をリセットしました']);
    }
}
