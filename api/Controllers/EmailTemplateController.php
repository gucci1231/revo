<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
use Api\Repositories\EmailTemplateRepository;
use Api\Repositories\VisitorRepository;
use Api\Services\GasWebhookService;

class EmailTemplateController extends Controller {
    private EmailTemplateRepository $templateRepo;
    private VisitorRepository $visitorRepo;
    private GasWebhookService $gasWebhookService;

    public function __construct(
        ?EmailTemplateRepository $templateRepo = null,
        ?VisitorRepository $visitorRepo = null,
        ?GasWebhookService $gasWebhookService = null
    ) {
        parent::__construct();
        $this->templateRepo = $templateRepo ?? new EmailTemplateRepository();
        $this->visitorRepo = $visitorRepo ?? new VisitorRepository();
        $this->gasWebhookService = $gasWebhookService ?? new GasWebhookService();
    }

    public function handle(): void {
        $action = $this->getAction();

        switch ($action) {
            case 'list':
            case 'get':
                $this->listTemplates();
                break;
            case 'update':
                $this->updateTemplate();
                break;
            case 'send':
                $this->sendEmail();
                break;
            default:
                $this->listTemplates();
                break;
        }
    }

    private function listTemplates(): void {
        $templates = $this->templateRepo->getAll();
        Response::success(['templates' => $templates]);
    }

    private function updateTemplate(): void {
        $id = $this->getParam('id', '') ?: $this->getParam('templateKey', '');
        $subject = $this->getParam('subject', '');
        $body = $this->getParam('body', '');

        if (!$id) {
            Response::error('Template ID/key is required');
            return;
        }
        if (trim($subject) === '') {
            Response::error('件名を入力してください');
            return;
        }
        if (trim($body) === '') {
            Response::error('本文を入力してください');
            return;
        }

        $this->templateRepo->update($id, $subject, $body);

        // GAS / GoogleスプレッドシートへWebhook送信
        $gasSynced = $this->gasWebhookService->updateEmailTemplate($id, $subject, $body);

        Response::success([
            'id' => $id,
            'subject' => $subject,
            'body' => $body,
            'gasSynced' => $gasSynced,
            'message' => 'メールテンプレートを更新し、スプレッドシートへ同期しました'
        ]);
    }

    private function sendEmail(): void {
        $visitorId = (string)$this->getParam('visitorId', '');
        $templateKey = (string)$this->getParam('templateKey', '');
        $customSubject = $this->getParam('customSubject', null);
        $customBody = $this->getParam('customBody', null);

        if (!$visitorId || !$templateKey) {
            Response::error('visitorId and templateKey are required');
            return;
        }

        $result = $this->gasWebhookService->sendEmail($visitorId, $templateKey, $customSubject, $customBody);
        if (!empty($result['success'])) {
            Response::success($result);
        } else {
            Response::error($result['error'] ?? 'GASからのメール送信に失敗しました');
        }
    }
}
