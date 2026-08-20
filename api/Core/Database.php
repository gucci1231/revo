<?php
namespace Api\Core;

use PDO;
use Exception;

/**
 * DRY SQLite Database Driver
 * Handles connection, schema setup, CRUD operations, Upserts, and Transactions.
 */
class Database {
    private static ?Database $instance = null;
    private PDO $pdo;

    public function __construct(?string $dbPath = null) {
        $dbPath = $dbPath ?? __DIR__ . '/../data/database.sqlite';
        $dir = dirname($dbPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }

        $this->pdo = new PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // Enable WAL mode for high concurrency & speed
        $this->pdo->exec("PRAGMA journal_mode = WAL;");

        $this->initSchema();
    }

    public static function getInstance(?string $dbPath = null): Database {
        if (self::$instance === null) {
            self::$instance = new Database($dbPath);
        }
        return self::$instance;
    }

    public function getPdo(): PDO {
        return $this->pdo;
    }

    private function initSchema(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS visitors (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                inviter TEXT,
                event_date TEXT,
                visitor_name TEXT,
                furigana TEXT,
                profession TEXT,
                company TEXT,
                email TEXT,
                attendance_count TEXT DEFAULT '初めて',
                remarks TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS visitors_status (
                visitor_id TEXT PRIMARY KEY,
                is_attended TEXT DEFAULT '未',
                is_joined TEXT DEFAULT '未',
                is_1to1 TEXT DEFAULT '未',
                is_matched TEXT DEFAULT '未',
                matching_note TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS hearing_sheets (
                visitor_id TEXT PRIMARY KEY,
                orient_user TEXT DEFAULT '',
                q1 TEXT DEFAULT '',
                q2 TEXT DEFAULT '',
                q3 TEXT DEFAULT '',
                q4 TEXT DEFAULT '',
                q5 TEXT DEFAULT '',
                q6 TEXT DEFAULT '',
                q7 TEXT DEFAULT '',
                feel_abc TEXT DEFAULT '',
                orient_memo TEXT DEFAULT '',
                follow_memo TEXT DEFAULT '',
                sheet_url TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                category TEXT DEFAULT 'その他',
                name TEXT,
                profession TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS action_plans (
                id TEXT PRIMARY KEY,
                visitor_id TEXT NOT NULL,
                due_date TEXT,
                assignee_name TEXT DEFAULT '',
                assignee_id TEXT DEFAULT '',
                action_type TEXT DEFAULT '',
                action_text TEXT NOT NULL,
                report_text TEXT DEFAULT '',
                reporter_name TEXT DEFAULT '',
                completed_by TEXT DEFAULT '',
                is_completed INTEGER DEFAULT 0,
                completed_at TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT DEFAULT 'welcome',
                subject TEXT NOT NULL,
                body TEXT NOT NULL,
                description TEXT DEFAULT '',
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_action_plans_visitor_id ON action_plans(visitor_id);
        ");

        $this->seedDefaultEmailTemplates();

        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN action_type TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN report_text TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN reporter_name TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
        try {
            $this->pdo->exec("ALTER TABLE action_plans ADD COLUMN completed_by TEXT DEFAULT ''");
        } catch (\PDOException $e) {}
    }

    private function seedDefaultEmailTemplates(): void {
        $now = date('Y/m/d H:i');
        $defaults = [
            [
                'id' => 'EMAIL_VISITOR_INTRO',
                'name' => '新規ビジター参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '初めてお申し込みいただいたビジター様へ送信する初回案内メールです。',
                'subject' => '【BNI REvoチャプター】定例会ご参加のお申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'はじめまして！BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'この度は、{$event_date} 開催の定例会へのお申し込みをいただき誠にありがとうございます！' . "\n\n" .
                    '【ご紹介者様】{$inviter} 様' . "\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '当日は、{$name} 様のビジネス（{$profession}）の発展に繋がる素晴らしい出会いをご提供できるよう、メンバー一同心より歓迎いたします。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '何かご不明点やご質問などございましたら、お気軽にこのメールへご返信ください。' . "\n" .
                    'それでは当日お会いできますことを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_GUEST_INTRO',
                'name' => '他チャプターゲスト参加案内 (Welcome)',
                'category' => 'welcome',
                'description' => '他チャプターからゲスト参加されるメンバー様向けの参加案内メールです。',
                'subject' => '【BNI REvoチャプター】ゲスト参加のお申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'この度は、{$event_date} 開催のREvoチャプター定例会へゲスト参加のお申し込みをいただきありがとうございます！' . "\n\n" .
                    '【ご紹介者様】{$inviter} 様' . "\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '他チャプター様との活発なビジネス交流ができる場をご用意してお待ちしております。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '当日どうぞよろしくお願いいたします！'
            ],
            [
                'id' => 'EMAIL_REPEATER_INTRO',
                'name' => '再参加リピーター案内 (Welcome)',
                'category' => 'welcome',
                'description' => '2回目以降の参加となるリピータービジター様への参加案内メールです。',
                'subject' => '【BNI REvoチャプター】再度のご参加お申し込みありがとうございます（{$event_date}開催）',
                'body' => '{$name} 様' . "\n\n" .
                    'いつも大変お世話になっております！BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '{$event_date} の定例会に再びご参加いただけるとのこと、大変嬉しく思っております！' . "\n\n" .
                    '【ご参加日】{$event_date}' . "\n\n" .
                    '前回に引き続き、{$name} 様のビジネス発展に繋がる有意義な時間となるよう努めてまいります。' . "\n\n" .
                    '{$matching_status}' . "\n\n" .
                    '当日お会いできることをメンバー一同心よりお待ちしております！'
            ],
            [
                'id' => 'EMAIL_REMIND_2DAYS',
                'name' => '定例会 2日前リマインド',
                'category' => 'remind',
                'description' => '定例会開催の2日前に事前準備や日程のリマインドとして送信するメールです。',
                'subject' => '【リマインド】定例会開催まであと2日となりました（{$event_date}）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '{$event_date} 開催の定例会が、いよいよ明後日となりました！' . "\n\n" .
                    '【開催日時】{$event_date} 6:45受付開始 / 7:00開会' . "\n" .
                    '【メインプレゼンター】{$main_presenter} 様' . "\n" .
                    '【求めている紹介】{$wanted}' . "\n\n" .
                    '当日は名刺・筆記用具をご準備の上、お気をつけてお越しくださいませ。' . "\n" .
                    '皆様とお会いできるのを楽しみにしております。'
            ],
            [
                'id' => 'EMAIL_REMIND_1DAY',
                'name' => '定例会 前日リマインド',
                'category' => 'remind',
                'description' => '定例会開催の前日に最終確認として送信するメールです。',
                'subject' => '【明日開催】BNI REvoチャプター定例会のご案内（{$event_date}）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    'いよいよ明日 {$event_date}、定例会が開催されます！' . "\n\n" .
                    '【開催日時】明日 {$event_date} 6:45受付開始 / 7:00開会' . "\n\n" .
                    '朝早い時間帯となりますが、充実したビジネス交流の場となるよう準備を整えております。' . "\n" .
                    '道中どうぞお気をつけてお越しください。' . "\n" .
                    '明日お会いできることを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_THANKS_ATTENDED',
                'name' => '定例会ご参加御礼メール',
                'category' => 'thanks',
                'description' => '定例会に参加いただいたビジター様へ当日に送信するお礼メールです。',
                'subject' => '【御礼】本日のBNI REvoチャプター定例会にご参加いただきありがとうございました',
                'body' => '{$name} 様' . "\n\n" .
                    '本日は朝早くからBNI REvoチャプターの定例会にご参加いただき、誠にありがとうございました！' . "\n\n" .
                    '{$name} 様とお話しでき、素晴らしいご縁をいただけましたこと、メンバー一同大変嬉しく思っております。' . "\n" .
                    '本日のミーティングはいかがでしたでしょうか？' . "\n\n" .
                    '定例会を通じて気になったメンバーや、さらに詳しく話してみたい業種がございましたら、ぜひお気軽に1to1（個別面談）をお申し付けください。' . "\n\n" .
                    'またお会いできることを楽しみにしております！'
            ],
            [
                'id' => 'EMAIL_THANKS_ABSENT',
                'name' => '定例会欠席フォローメール',
                'category' => 'thanks',
                'description' => '定例会を欠席されたビジター様へお見舞いと次回案内を兼ねて送信するメールです。',
                'subject' => '【BNI REvoチャプター】本日の定例会について（次回日程のご案内）',
                'body' => '{$name} 様' . "\n\n" .
                    'BNI REvoチャプター ビジターホストチームです。' . "\n" .
                    '本日はご都合がつかず残念でしたが、体調やお仕事の状況はいかがでしょうか？' . "\n\n" .
                    'またご都合の良い日程がございましたら、いつでも振替参加を歓迎しております！' . "\n" .
                    '次回以降の定例会日程についてもお気軽にお問い合わせください。' . "\n\n" .
                    '{$name} 様にお会いできる日をメンバー一同心待ちにしております。'
            ],
            [
                'id' => 'EMAIL_FOLLOW_7DAYS',
                'name' => '参加1週間後フォローメール',
                'category' => 'follow',
                'description' => '参加から1週間が経過したタイミングでビジネスの進捗や1to1の確認を行うフォローメールです。',
                'subject' => '【その後いかがでしょうか？】BNI REvoチャプターよりご挨拶',
                'body' => '{$name} 様' . "\n\n" .
                    '先週は定例会にご参加いただきありがとうございました！ビジターホストチームです。' . "\n\n" .
                    '定例会から1週間が経ちましたが、その後お仕事の状況はいかがでしょうか？' . "\n\n" .
                    '当チャプターのメンバーとの繋がりや、ビジネスに関するご相談など、何かお役に立てることがあればいつでもお声がけください。' . "\n\n" .
                    'また次回の定例会へのご参加も大歓迎です！'
            ],
            [
                'id' => 'EMAIL_FOLLOW_30DAYS',
                'name' => '参加1ヶ月後フォローメール',
                'category' => 'follow',
                'description' => '参加から1ヶ月が経過したタイミングでの定期フォロー・リコネクトメールです。',
                'subject' => '【定期フォロー】BNI REvoチャプターより近況のお伺い',
                'body' => '{$name} 様' . "\n\n" .
                    '先月は当チャプター定例会へご参加いただき誠にありがとうございました。' . "\n" .
                    '早いもので定例会から1ヶ月が経過いたしました。' . "\n\n" .
                    '{$name} 様のビジネス（{$profession}）において、新たなリファーラル（紹介）やビジネスマッチングのお手伝いができる機会がございましたら幸いです。' . "\n\n" .
                    'ぜひまたチャプター定例会へも遊びにいらしてください！'
            ]
        ];

        // Check if templates need update / repair
        $sample = $this->fetchOne("SELECT body FROM email_templates WHERE id = 'EMAIL_VISITOR_INTRO'");
        if (!$sample || str_contains($sample['subject'] ?? '', 'レボリューション') || str_contains($sample['body'] ?? '', 'レボリューション') || !str_contains($sample['body'] ?? '', '{$name}')) {
            foreach ($defaults as $tmpl) {
                $this->upsert('email_templates', [
                    'id' => $tmpl['id'],
                    'name' => $tmpl['name'],
                    'category' => $tmpl['category'],
                    'description' => $tmpl['description'],
                    'subject' => $tmpl['subject'],
                    'body' => $tmpl['body'],
                    'updated_at' => $now
                ], ['id']);
            }
        }
    }

    public function fetchOne(string $sql, array $params = []): ?array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result !== false ? $result : null;
    }

    public function fetchAll(string $sql, array $params = []): array {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function fetchColumn(string $sql, array $params = []): mixed {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchColumn();
    }

    public function execute(string $sql, array $params = []): int {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function insert(string $table, array $data): int {
        $cols = array_keys($data);
        $escapedCols = array_map(fn($c) => "`{$c}`", $cols);
        $placeholders = array_fill(0, count($cols), '?');
        $sql = sprintf(
            "INSERT INTO `%s` (%s) VALUES (%s)",
            $table,
            implode(', ', $escapedCols),
            implode(', ', $placeholders)
        );
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_values($data));
        return $stmt->rowCount();
    }

    public function update(string $table, array $data, string $where, array $whereParams = []): int {
        $sets = array_map(fn($col) => "`{$col}` = ?", array_keys($data));
        $sql = sprintf(
            "UPDATE `%s` SET %s WHERE %s",
            $table,
            implode(', ', $sets),
            $where
        );
        $params = array_merge(array_values($data), $whereParams);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function upsert(string $table, array $data, array $uniqueKeys): bool {
        $whereClauses = [];
        $whereParams = [];
        foreach ($uniqueKeys as $uKey) {
            $whereClauses[] = "`{$uKey}` = ?";
            $whereParams[] = $data[$uKey] ?? null;
        }
        $whereSql = implode(' AND ', $whereClauses);

        $exists = (int)$this->fetchColumn(sprintf("SELECT COUNT(*) FROM `%s` WHERE %s", $table, $whereSql), $whereParams);
        if ($exists > 0) {
            $updateCols = array_diff(array_keys($data), $uniqueKeys);
            if (empty($updateCols)) {
                return true; // Nothing to update
            }
            $updateData = [];
            foreach ($updateCols as $col) {
                $updateData[$col] = $data[$col];
            }
            return $this->update($table, $updateData, $whereSql, $whereParams) >= 0;
        } else {
            return $this->insert($table, $data) > 0;
        }
    }

    public function transaction(callable $callback): mixed {
        $this->pdo->beginTransaction();
        try {
            $result = $callback($this);
            $this->pdo->commit();
            return $result;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
