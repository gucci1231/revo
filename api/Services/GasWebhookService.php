<?php
namespace Api\Services;

use Exception;

class GasWebhookService {
    private string $gasUrl;

    public function __construct(?string $gasUrl = null) {
        $this->gasUrl = $gasUrl ?? "https://script.google.com/macros/s/AKfycbydC-gIMjpdAoeQpsgIwq-RQcBzWHZ17yijcMxc_zm2BNZfWxbij9DO2XutZxs1jO11/exec";
    }

    public function syncVisitorStatus(string $visitorId, string $field, string $value): void {
        try {
            $payload = json_encode([
                'action' => 'update_status',
                'visitorId' => $visitorId,
                'field' => $field,
                'value' => $value
            ]);

            $ch = curl_init($this->gasUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            curl_close($ch);
        } catch (Exception $e) {
            // Webhook failure should not block main application flow
        }
    }

    public function updateEmailTemplate(string $templateKey, string $subject, string $body): bool {
        try {
            $payload = json_encode([
                'action' => 'update_template',
                'templateKey' => $templateKey,
                'subject' => $subject,
                'body' => $body
            ]);

            $ch = curl_init($this->gasUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 8);
            $res = curl_exec($ch);
            curl_close($ch);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public function sendEmail(string $visitorId, string $templateKey, ?string $customSubject = null, ?string $customBody = null): array {
        try {
            $payload = json_encode([
                'action' => 'send_mail',
                'visitorId' => $visitorId,
                'templateKey' => $templateKey,
                'customSubject' => $customSubject,
                'customBody' => $customBody
            ]);

            $ch = curl_init($this->gasUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            $res = curl_exec($ch);
            curl_close($ch);
            $decoded = json_decode($res, true);
            return is_array($decoded) ? $decoded : ['success' => true, 'message' => 'GAS送信リクエストを完了しました'];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
