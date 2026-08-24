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
            $list = $this->actionPlanRepo->getAllWithVisitor(null, 300);
            Response::success([
                'visitorId' => '',
                'list' => $list
            ]);
            return;
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
        $visitorId = $this->getParam('visitorId', '') ?: $this->getParam('visitor_id', '');
        $actionText = trim($this->getParam('actionText', '') ?: $this->getParam('action_text', ''));

        if (!$visitorId) {
            Response::error('visitorId is required');
        }
        if (!$actionText) {
            Response::error('アクション内容は必須です');
        }

        $rawAssignee = $this->getParam('assigneeName', '') ?: $this->getParam('assignee_name', '');
        $assigneeName = \Api\Services\MemberNameResolver::resolve((string)$rawAssignee);

        $id = $this->actionPlanRepo->create([
            'visitor_id' => $visitorId,
            'due_date' => $this->getParam('dueDate', '') ?: $this->getParam('due_date', ''),
            'assignee_name' => $assigneeName,
            'assignee_id' => $this->getParam('assigneeId', '') ?: $this->getParam('assignee_id', ''),
            'action_type' => $this->getParam('actionType', '') ?: $this->getParam('action_type', ''),
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

        $visitorId = $this->getParam('visitorId', '') ?: $this->getParam('visitor_id', '');
        $data = [];
        if ($this->getParam('dueDate') !== null || $this->getParam('due_date') !== null) {
            $data['due_date'] = $this->getParam('dueDate', '') ?: $this->getParam('due_date', '');
        }
        if ($this->getParam('assigneeName') !== null || $this->getParam('assignee_name') !== null) {
            $rawAssignee = $this->getParam('assigneeName', '') ?: $this->getParam('assignee_name', '');
            $data['assignee_name'] = \Api\Services\MemberNameResolver::resolve((string)$rawAssignee);
        }
        if ($this->getParam('actionType') !== null || $this->getParam('action_type') !== null) {
            $data['action_type'] = $this->getParam('actionType', '') ?: $this->getParam('action_type', '');
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
        $rawReporter = trim($this->getParam('reporterName', '') ?: $this->getParam('reporter_name', ''));
        $reporterName = \Api\Services\MemberNameResolver::resolve($rawReporter);
        $isCompleted = $this->getParam('isCompleted', null) ?? $this->getParam('is_completed', 1);

        $item = $this->actionPlanRepo->saveReport($id, $reportText, $reporterName, (int)$isCompleted === 1);
        if (!$item) {
            Response::error('Action plan not found');
        }

        // アクション完了時のメール通知トリガー
        if ((int)$isCompleted === 1) {
            $this->sendActionCompletedNotification($item, $reportText, $reporterName);
        }

        $vId = $item['visitor_id'];
        Response::success([
            'id' => $id,
            'item' => $item,
            'list' => $this->actionPlanRepo->getByVisitorId($vId)
        ]);
    }

    private function sendActionCompletedNotification(array $actionPlan, string $reportText, string $reporterName): void {
        try {
            $templateRepo = new \Api\Repositories\ReportTemplateRepository();
            $tpl = $templateRepo->getById('action_completed');
            if (!$tpl || intval($tpl['is_enabled'] ?? 1) !== 1) {
                return;
            }

            $recipients = trim($tpl['default_recipients'] ?? 'info@k-d-o.biz');
            if (empty($recipients)) return;

            $vRepo = new \Api\Repositories\VisitorRepository();
            $visitor = $vRepo->getById($actionPlan['visitor_id'] ?? '');

            $extra = [
                'assignee_name' => !empty($reporterName) ? $reporterName : ($actionPlan['assignee_name'] ?? '担当メンバー'),
                'visitor_name' => $visitor['name'] ?? $actionPlan['visitor_name'] ?? 'ビジター',
                'visitor_company' => $visitor['company'] ?? '',
                'business_category' => $visitor['business_category'] ?? $visitor['category'] ?? '',
                'inviter_name' => $visitor['inviter'] ?? 'チャプター',
                'action_title' => $actionPlan['action'] ?? $actionPlan['content'] ?? 'フォローアクション',
                'action_report' => !empty($reportText) ? $reportText : '無事完了しました。',
                'visitor_id' => $actionPlan['visitor_id'] ?? ''
            ];

            $contextService = new \Api\Services\ReportContextService();
            $context = $contextService->buildContext($extra);
            $subject = $contextService->replacePlaceholders($tpl['email_subject'] ?? '', $context);
            $body = $contextService->replacePlaceholders($tpl['email_html_body'] ?? '', $context);

            $mailService = new \Api\Services\MailService();
            $recipientList = array_map('trim', explode(',', $recipients));
            foreach ($recipientList as $toEmail) {
                if (filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
                    $mailService->sendHtmlEmail($toEmail, $subject, $body);
                }
            }
        } catch (\Throwable $e) {
            // 通知エラーで本体のレスポンスをブロックしない
            error_log("Failed to send action completed notification: " . $e->getMessage());
        }
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

