<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\ActionPlanRepository;

class ActionPlanController extends Controller {
    private ActionPlanRepository $actionPlanRepo;

    public function __construct(?ActionPlanRepository $actionPlanRepo = null) {
        parent::__construct();
        $this->actionPlanRepo = $actionPlanRepo ?? new ActionPlanRepository();
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
            case 'create':
            case 'add':
                $this->create();
                break;
            case 'update':
                $this->update();
                break;
            case 'toggle':
                $this->toggle();
                break;
            case 'report':
                $this->report();
                break;
            case 'delete':
                $this->delete();
                break;
            default:
                Response::error('Invalid action');
        }
    }

    private function list(): void {
        $visitorId = $this->getParam('visitorId', '');
        if (!$visitorId) {
            Response::error('visitorId is required');
        }

        $list = $this->actionPlanRepo->getByVisitorId($visitorId);
        Response::success([
            'visitorId' => $visitorId,
            'list' => $list
        ]);
    }

    private function detail(): void {
        $id = $this->getParam('id', '');
        if (!$id) {
            Response::error('id is required');
        }

        $item = $this->actionPlanRepo->findById($id);
        if (!$item) {
            Response::error('Action plan not found');
        }

        Response::success([
            'id' => $id,
            'item' => $item
        ]);
    }

    private function create(): void {
        $visitorId = $this->getParam('visitorId', '');
        $actionText = trim($this->getParam('actionText', '') ?: $this->getParam('action_text', ''));

        if (!$visitorId) {
            Response::error('visitorId is required');
        }
        if (!$actionText) {
            Response::error('アクション内容は必須です');
        }

        $id = $this->actionPlanRepo->create([
            'visitor_id' => $visitorId,
            'due_date' => $this->getParam('dueDate', '') ?: $this->getParam('due_date', ''),
            'assignee_name' => $this->getParam('assigneeName', '') ?: $this->getParam('assignee_name', ''),
            'assignee_id' => $this->getParam('assigneeId', '') ?: $this->getParam('assignee_id', ''),
            'action_text' => $actionText,
            'is_completed' => 0
        ]);

        $item = $this->actionPlanRepo->findById($id);
        Response::success([
            'id' => $id,
            'item' => $item,
            'list' => $this->actionPlanRepo->getByVisitorId($visitorId)
        ]);
    }

    private function update(): void {
        $id = $this->getParam('id', '');
        if (!$id) {
            Response::error('id is required');
        }

        $visitorId = $this->getParam('visitorId', '');
        $data = [];
        if ($this->getParam('dueDate') !== null || $this->getParam('due_date') !== null) {
            $data['due_date'] = $this->getParam('dueDate', '') ?: $this->getParam('due_date', '');
        }
        if ($this->getParam('assigneeName') !== null || $this->getParam('assignee_name') !== null) {
            $data['assignee_name'] = $this->getParam('assigneeName', '') ?: $this->getParam('assignee_name', '');
        }
        if ($this->getParam('actionText') !== null || $this->getParam('action_text') !== null) {
            $data['action_text'] = $this->getParam('actionText', '') ?: $this->getParam('action_text', '');
        }
        if ($this->getParam('isCompleted') !== null || $this->getParam('is_completed') !== null) {
            $data['is_completed'] = (int)($this->getParam('isCompleted') ?? $this->getParam('is_completed'));
        }

        $this->actionPlanRepo->update($id, $data);
        $item = $this->actionPlanRepo->findById($id);
        $vId = $visitorId ?: ($item ? $item['visitor_id'] : '');

        Response::success([
            'id' => $id,
            'item' => $item,
            'list' => $vId ? $this->actionPlanRepo->getByVisitorId($vId) : []
        ]);
    }

    private function toggle(): void {
        $id = $this->getParam('id', '');
        if (!$id) {
            Response::error('id is required');
        }

        $forceStatus = $this->getParam('isCompleted', null) ?? $this->getParam('is_completed', null);
        if ($forceStatus !== null) {
            $forceStatus = (int)$forceStatus;
        }

        $item = $this->actionPlanRepo->toggleComplete($id, $forceStatus);
        if (!$item) {
            Response::error('Action plan not found');
        }

        $vId = $item['visitor_id'];
        Response::success([
            'id' => $id,
            'item' => $item,
            'list' => $this->actionPlanRepo->getByVisitorId($vId)
        ]);
    }

    private function report(): void {
        $id = $this->getParam('id', '');
        if (!$id) {
            Response::error('id is required');
        }

        $reportText = trim($this->getParam('reportText', '') ?: $this->getParam('report_text', ''));
        $reporterName = trim($this->getParam('reporterName', '') ?: $this->getParam('reporter_name', ''));
        $isCompleted = $this->getParam('isCompleted', null) ?? $this->getParam('is_completed', 1);

        $item = $this->actionPlanRepo->saveReport($id, $reportText, $reporterName, (int)$isCompleted === 1);
        if (!$item) {
            Response::error('Action plan not found');
        }

        $vId = $item['visitor_id'];
        Response::success([
            'id' => $id,
            'item' => $item,
            'list' => $this->actionPlanRepo->getByVisitorId($vId)
        ]);
    }

    private function delete(): void {
        $id = $this->getParam('id', '');
        $visitorId = $this->getParam('visitorId', '');

        if (!$id) {
            Response::error('id is required');
        }

        $item = $this->actionPlanRepo->findById($id);
        $vId = $visitorId ?: ($item ? $item['visitor_id'] : '');

        $this->actionPlanRepo->delete($id);

        Response::success([
            'id' => $id,
            'list' => $vId ? $this->actionPlanRepo->getByVisitorId($vId) : []
        ]);
    }
}
