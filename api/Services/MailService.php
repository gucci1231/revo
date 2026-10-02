<?php
namespace Api\Services;

use Api\Repositories\SettingRepository;
use Api\Core\Database;

class MailService {
    private string $fromEmail;
    private string $fromName;
    private ?SettingRepository $settingRepo;

    public function __construct(
        string $fromEmail = 'info@k-d-o.biz',
        string $fromName = 'Visitor Host Revolution',
        ?SettingRepository $settingRepo = null
    ) {
        $this->fromEmail = $fromEmail;
        $this->fromName = $fromName;
        $this->settingRepo = $settingRepo;
    }

    private function getSettingRepo(): SettingRepository {
        if ($this->settingRepo === null) {
            $this->settingRepo = new SettingRepository();
        }
        return $this->settingRepo;
    }

    /**
     * Send UTF-8 HTML Email (with Automatic Test Mode Safety Interception)
     */
    public function sendHtmlEmail(string $to, string $subject, string $htmlBody, string $replyTo = ''): array {
        $cleanTo = trim($to);
        if (empty($cleanTo) || !filter_var($cleanTo, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'message' => '有効な宛先メールアドレスを指定してください'];
        }

        // --- 🛡️ テスト配信セーフティ（メンバーへの誤配信防止 & 管理者転送） ---
        $testMode = true; // デフォルトは安全のためテストモードON
        $testRecipient = 'info@k-d-o.biz';

        try {
            $repo = $this->getSettingRepo();
            $valMode = $repo->getByKey('mail_test_mode');
            if ($valMode !== null) {
                $testMode = filter_var($valMode, FILTER_VALIDATE_BOOLEAN);
            }
            $valRecipient = $repo->getByKey('mail_test_recipient');
            if (!empty($valRecipient)) {
                $testRecipient = trim($valRecipient);
            }
        } catch (\Throwable $e) {
            $testMode = true;
        }

        $isTestRedirected = false;
        $originalRecipient = $cleanTo;

        if ($testMode && strtolower($cleanTo) !== strtolower($testRecipient)) {
            $cleanTo = $testRecipient;
            $isTestRedirected = true;

            // メンバー氏名の自動逆引き
            $memberName = '';
            try {
                $db = Database::getInstance();
                $member = $db->fetch("SELECT name FROM members WHERE email = ? LIMIT 1", [$originalRecipient]);
                if ($member && !empty($member['name'])) {
                    $memberName = $member['name'];
                }
            } catch (\Throwable $e) {}

            $targetLabel = !empty($memberName) ? "{$memberName}様 ({$originalRecipient})" : $originalRecipient;
            $subject = "[TEST配信 ➔ {$targetLabel}] " . $subject;

            // Appleスタイルのテスト配信案内バナー
            $testBanner = '
            <div style="background-color: #fefce8; border: 1.5px solid #eab308; border-radius: 12px; padding: 14px 18px; margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="font-size: 15px;">🧪</span>
                    <span style="font-size: 13px; font-weight: 800; color: #854d0e; letter-spacing: 0.02em;">【テスト配信モード稼働中】</span>
                </div>
                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #713f12;">
                    本システムは現在テスト段階のため、メンバー本人への実送信を安全にインターセプトし、管理者（<strong>' . htmlspecialchars($testRecipient) . '</strong>）宛てに転送送信されました。<br>
                    <strong>本来の宛先:</strong> ' . htmlspecialchars($targetLabel) . '
                </p>
            </div>';

            $htmlBody = $testBanner . $htmlBody;
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
            $msg = $isTestRedirected
                ? "{$originalRecipient} 宛のメールをテスト受信先（{$cleanTo}）へ転送送信しました"
                : "{$cleanTo} へのメール送信が完了しました";

            return [
                'success' => true,
                'message' => $msg,
                'test_mode' => $testMode,
                'redirected' => $isTestRedirected,
                'original_recipient' => $originalRecipient,
                'sent_to' => $cleanTo
            ];
        } else {
            return ['success' => false, 'message' => 'メール送信に失敗しました。サーバーのメール設定をご確認ください。'];
        }
    }
}
