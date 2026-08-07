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
}
