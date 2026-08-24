<?php
namespace Api\Controllers;

use Api\Repositories\ReportTemplateRepository;
use Api\Services\MailService;

class ReportController extends Controller {
    private ReportTemplateRepository $templateRepo;
    private MailService $mailService;

    public function __construct(
        ?ReportTemplateRepository $templateRepo = null,
        ?MailService $mailService = null
    ) {
        parent::__construct();
        $this->templateRepo = $templateRepo ?? new ReportTemplateRepository();
        $this->mailService = $mailService ?? new MailService();
    }

    public function handle(): void {
        $action = $this->getParam('action', 'list');

        switch ($action) {
            case 'list':
                $this->listTemplates();
                break;
            case 'update':
                $this->updateTemplate();
                break;
            case 'toggle':
                $this->toggleTemplate();
                break;
            case 'send_mail':
                $this->sendMail();
                break;
            default:
                $this->error("Invalid action: {$action}", 400);
        }
    }

    private function listTemplates(): void {
        $templates = $this->templateRepo->getAll();
        $this->json(['templates' => $templates]);
    }

    private function updateTemplate(): void {
        $id = $this->getParam('id');
        if (empty($id)) {
            $this->error('Template ID is required', 400);
            return;
        }

        $data = [];
        if ($this->hasParam('title')) $data['title'] = $this->getParam('title');
        if ($this->hasParam('is_enabled')) $data['is_enabled'] = intval($this->getParam('is_enabled'));
        if ($this->hasParam('email_subject')) $data['email_subject'] = $this->getParam('email_subject');
        if ($this->hasParam('email_html_body')) $data['email_html_body'] = $this->getParam('email_html_body');
        if ($this->hasParam('line_template_body')) $data['line_template_body'] = $this->getParam('line_template_body');
        if ($this->hasParam('default_recipients')) $data['default_recipients'] = $this->getParam('default_recipients');

        $success = $this->templateRepo->update($id, $data);
        if ($success) {
            $updated = $this->templateRepo->getById($id);
            $this->json(['success' => true, 'template' => $updated]);
        } else {
            $this->error('Failed to update template', 500);
        }
    }

    private function toggleTemplate(): void {
        $id = $this->getParam('id');
        $isEnabled = intval($this->getParam('is_enabled', 1));

        if (empty($id)) {
            $this->error('Template ID is required', 400);
            return;
        }

        $success = $this->templateRepo->toggleEnabled($id, $isEnabled);
        $this->json(['success' => $success, 'id' => $id, 'is_enabled' => $isEnabled]);
    }

    private function sendMail(): void {
        $to = $this->getParam('to', 'info@k-d-o.biz');
        $subject = $this->getParam('subject', '');
        $htmlBody = $this->getParam('body', '');

        if (empty($to)) {
            $this->error('送信先アドレス（to）を指定してください', 400);
            return;
        }

        if (empty($subject) || empty($htmlBody)) {
            $this->error('件名と本文を指定してください', 400);
            return;
        }

        $result = $this->mailService->sendHtmlEmail($to, $subject, $htmlBody);
        if ($result['success']) {
            $this->json(['success' => true, 'message' => $result['message']]);
        } else {
            $this->error($result['message'], 500);
        }
    }
}
