<?php
namespace Api\Services;

class MailService {
    private string $fromEmail;
    private string $fromName;

    public function __construct(string $fromEmail = 'info@k-d-o.biz', string $fromName = 'Visitor Host Revolution') {
        $this->fromEmail = $fromEmail;
        $this->fromName = $fromName;
    }

    /**
     * Send UTF-8 HTML Email
     */
    public function sendHtmlEmail(string $to, string $subject, string $htmlBody, string $replyTo = ''): array {
        $cleanTo = trim($to);
        if (empty($cleanTo) || !filter_var($cleanTo, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'message' => '有効な宛先メールアドレスを指定してください'];
        }

        $replyTo = !empty($replyTo) ? $replyTo : $this->fromEmail;

        // Headers
        $headers = [];
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-type: text/html; charset=UTF-8';
        $encodedFromName = '=?UTF-8?B?' . base64_encode($this->fromName) . '?=';
        $headers[] = "From: {$encodedFromName} <{$this->fromEmail}>";
        $headers[] = "Reply-To: {$replyTo}";
        $headers[] = "X-Mailer: PHP/" . phpversion();

        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

        $headerStr = implode("\r\n", $headers);

        // Sendmail envelope sender (-f)
        $additionalParams = "-f" . escapeshellcmd($this->fromEmail);

        $sent = @mail($cleanTo, $encodedSubject, $htmlBody, $headerStr, $additionalParams);

        if (!$sent) {
            // Fallback without -f if server disallows additional parameters
            $sent = @mail($cleanTo, $encodedSubject, $htmlBody, $headerStr);
        }

        if ($sent) {
            return ['success' => true, 'message' => "{$cleanTo} へのメール送信が完了しました"];
        } else {
            return ['success' => false, 'message' => 'メール送信に失敗しました。サーバーのメール設定をご確認ください。'];
        }
    }
}
