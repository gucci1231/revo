<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\VisitorRepository;
use Api\Repositories\HearingRepository;
use Api\Services\GasWebhookService;

class VisitorController extends Controller {
    private VisitorRepository $visitorRepo;
    private HearingRepository $hearingRepo;
    private GasWebhookService $gasWebhookService;

    public function __construct(
        ?VisitorRepository $visitorRepo = null,
        ?HearingRepository $hearingRepo = null,
        ?GasWebhookService $gasWebhookService = null
    ) {
        parent::__construct();
        $this->visitorRepo = $visitorRepo ?? new VisitorRepository();
        $this->hearingRepo = $hearingRepo ?? new HearingRepository();
        $this->gasWebhookService = $gasWebhookService ?? new GasWebhookService();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
                $this->list();
                break;
            case 'detail':
                $this->detail();
                break;
            case 'add':
                $this->add();
                break;
            case 'update_status':
                $this->updateStatus();
                break;
            case 'save_memo':
                $this->saveMemo();
                break;
            case 'delete':
                $this->delete();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function list(): void {
        $list = $this->visitorRepo->getAllWithStatusAndHearing();
        Response::success(['list' => $list]);
    }

    private function detail(): void {
        $id = $this->getParam('id', '');
        if (!$id) {
            Response::error('ID is required');
        }

        $visitor = $this->visitorRepo->findById($id);
        if (!$visitor) {
            Response::error('Visitor not found');
        }

        $status = $this->visitorRepo->getStatusByVisitorId($id) ?: [
            'is_attended' => '未',
            'is_joined' => '未',
            'is_1to1' => '未',
            'is_matched' => '未'
        ];

        $hearing = $this->hearingRepo->findByVisitorId($id);

        Response::success([
            'visitor' => [
                'id' => $visitor['id'],
                'createdAt' => $visitor['created_at'],
                'inviter' => $visitor['inviter'],
                'eventDate' => $visitor['event_date'],
                'name' => $visitor['visitor_name'],
                'furigana' => $visitor['furigana'],
                'profession' => $visitor['profession'],
                'company' => $visitor['company'],
                'email' => $visitor['email'],
                'attendanceCount' => $visitor['attendance_count'],
                'remarks' => $visitor['remarks']
            ],
            'status' => [
                'isAttended' => $status['is_attended'] ?? '未',
                'isJoined' => $status['is_joined'] ?? '未',
                'is1to1' => $status['is_1to1'] ?? '未',
                'matching' => $status['is_matched'] ?? '未'
            ],
            'hearing' => $hearing ? [
                'orientUser' => $hearing['orient_user'],
                'q1' => $hearing['q1'], 'q2' => $hearing['q2'], 'q3' => $hearing['q3'],
                'q4' => $hearing['q4'], 'q5' => $hearing['q5'], 'q6' => $hearing['q6'], 'q7' => $hearing['q7'],
                'feelAbc' => $hearing['feel_abc'],
                'orientMemo' => $hearing['orient_memo'],
                'followMemo' => $hearing['follow_memo'],
                'sheetUrl' => $hearing['sheet_url'],
                'updatedAt' => $hearing['updated_at']
            ] : null,
            'mailLogs' => []
        ]);
    }

    private function add(): void {
        $newId = $this->visitorRepo->getNextId();
        $now = date('Y/m/d H:i');

        $this->visitorRepo->createVisitor([
            'id' => $newId,
            'created_at' => $now,
            'inviter' => $this->getParam('inviter', ''),
            'event_date' => $this->getParam('eventDate', ''),
            'visitor_name' => $this->getParam('name', ''),
            'furigana' => $this->getParam('furigana', ''),
            'profession' => $this->getParam('profession', ''),
            'company' => $this->getParam('company', ''),
            'email' => $this->getParam('email', ''),
            'attendance_count' => $this->getParam('attendanceCount', '初めて'),
            'remarks' => $this->getParam('remarks', '')
        ]);

        $this->visitorRepo->createInitialStatus($newId, $now);

        Response::success(['visitorId' => $newId]);
    }

    private function updateStatus(): void {
        $vId = $this->getParam('visitorId', '');
        $field = $this->getParam('field', '');
        $val = $this->getParam('value', '');

        $colMap = [
            'isAttended' => 'is_attended',
            'isJoined' => 'is_joined',
            'is1to1' => 'is_1to1',
            'matching' => 'is_matched'
        ];

        if (!isset($colMap[$field])) {
            Response::error('Invalid field');
        }

        $col = $colMap[$field];
        $now = date('Y/m/d H:i');

        $this->visitorRepo->updateStatus($vId, $col, $val, $now);

        // Notify GAS Webhook
        $this->gasWebhookService->syncVisitorStatus($vId, $field, $val);

        Response::success(['visitorId' => $vId]);
    }

    private function saveMemo(): void {
        $vId = $this->getParam('visitorId', '');
        $memo = $this->getParam('memo', '');

        $this->visitorRepo->updateRemarks($vId, $memo);

        Response::success(['visitorId' => $vId, 'memo' => $memo]);
    }

    private function delete(): void {
        $vId = $this->getParam('id', '');
        if ($vId) {
            $this->visitorRepo->deleteVisitor($vId);
        }
        Response::success(['visitorId' => $vId]);
    }
}
