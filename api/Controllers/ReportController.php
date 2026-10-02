<?php
namespace Api\Controllers;

use Api\Core\Controller;
use Api\Core\Response;
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
            case 'reset':
                $this->resetTemplate();
                break;
            case 'send_mail':
                $this->sendMail();
                break;
            default:
                Response::error("Invalid action: {$action}", 400);
        }
    }

    private function resetTemplate(): void {
        $id = $this->getParam('id');
        if (empty($id)) {
            Response::error('Template ID is required', 400);
            return;
        }

        $template = $this->templateRepo->resetToDefault($id);
        if ($template) {
            Response::success(['template' => $template]);
        } else {
            Response::error('Template not found or cannot be reset', 404);
        }
    }

    private function listTemplates(): void {
        $templates = $this->templateRepo->getAll();
        Response::success(['templates' => $templates]);
    }

    private function updateTemplate(): void {
        $id = $this->getParam('id');
        if (empty($id)) {
            Response::error('Template ID is required', 400);
            return;
        }

        $data = [];
        if ($this->hasParam('title')) $data['title'] = $this->getParam('title');
        if ($this->hasParam('schedule_type')) $data['schedule_type'] = $this->getParam('schedule_type');
        if ($this->hasParam('schedule_day')) $data['schedule_day'] = $this->getParam('schedule_day');
        if ($this->hasParam('schedule_time')) $data['schedule_time'] = $this->getParam('schedule_time');
        if ($this->hasParam('is_enabled')) $data['is_enabled'] = intval($this->getParam('is_enabled'));
        if ($this->hasParam('email_subject')) $data['email_subject'] = $this->getParam('email_subject');
        if ($this->hasParam('email_html_body')) $data['email_html_body'] = $this->getParam('email_html_body');
        if ($this->hasParam('line_template_body')) $data['line_template_body'] = $this->getParam('line_template_body');
        if ($this->hasParam('default_recipients')) $data['default_recipients'] = $this->getParam('default_recipients');

        $success = $this->templateRepo->update($id, $data);
        if ($success) {
            $updated = $this->templateRepo->getById($id);
            Response::success(['template' => $updated]);
        } else {
            Response::error('Failed to update template', 500);
        }
    }

    private function toggleTemplate(): void {
        $id = $this->getParam('id');
        $isEnabled = intval($this->getParam('is_enabled', 1));

        if (empty($id)) {
            Response::error('Template ID is required', 400);
            return;
        }

        $success = $this->templateRepo->toggleEnabled($id, $isEnabled);
        Response::success(['id' => $id, 'is_enabled' => $isEnabled]);
    }

    private function sendMail(): void {
        $to = $this->getParam('to', 'info@k-d-o.biz');
        $subject = $this->getParam('subject', '');
        $htmlBody = $this->getParam('body', '');

        if (empty($to)) {
            Response::error('送信先アドレス（to）を指定してください', 400);
            return;
        }

        if (empty($subject) || empty($htmlBody)) {
            Response::error('件名と本文を指定してください', 400);
            return;
        }

        $result = $this->mailService->sendHtmlEmail($to, $subject, $htmlBody);
        if ($result['success']) {
            Response::success(['message' => $result['message']]);
        } else {
            Response::error($result['message'], 500);
        }
    }
}
