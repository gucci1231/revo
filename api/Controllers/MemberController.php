<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\MemberRepository;

class MemberController extends Controller {
    private MemberRepository $memberRepo;

    public function __construct(?MemberRepository $memberRepo = null) {
        parent::__construct();
        $this->memberRepo = $memberRepo ?? new MemberRepository();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
                $this->list();
                break;
            case 'add':
                $this->add();
                break;
            case 'update':
                $this->update();
                break;
            case 'delete':
                $this->delete();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function list(): void {
        $result = $this->memberRepo->getGroupedByCategory();
        Response::success($result);
    }

    private function add(): void {
        $newId = $this->memberRepo->getNextId();
        $now = date('Y/m/d H:i');

        $this->memberRepo->createMember([
            'id' => $newId,
            'category' => $this->getParam('category', 'その他'),
            'name' => $this->getParam('name', ''),
            'profession' => $this->getParam('profession', ''),
            'updated_at' => $now
        ]);

        Response::redirect('members.php?action=list');
    }

    private function update(): void {
        $mId = $this->getParam('id', '');
        $now = date('Y/m/d H:i');

        $this->memberRepo->updateMember($mId, [
            'category' => $this->getParam('category', 'その他'),
            'name' => $this->getParam('name', ''),
            'profession' => $this->getParam('profession', ''),
            'updated_at' => $now
        ]);

        Response::redirect('members.php?action=list');
    }

    private function delete(): void {
        $mId = $this->getParam('id', '');
        $this->memberRepo->deleteMember($mId);

        Response::redirect('members.php?action=list');
    }
}
